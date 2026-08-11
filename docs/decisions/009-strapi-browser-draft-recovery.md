# ADR-009: Browser draft recovery for Strapi Content Manager

**Status:** Proposed  
**Date:** 2026-08-11  
**Issue:** INTORG-1055

## Context

Editors lose work when the Strapi admin tab crashes, reloads, or hits a JS error mid-edit—especially on long dynamic zones (paragraphs, carousels, agendas). The team asked for recovery of unsaved work without enabling Draft & Publish or adding editor-facing UI chrome.

Constraints:

- This project runs **Strapi 5.41** with **Draft & Publish disabled** on most content types (schemas use `draftAndPublish: false`). Browser recovery is not a substitute for server-side drafts.
- There is **no maintained marketplace plugin** for full Content Manager form autosave.
- Strapi **Content History** only records **already-saved** versions, not in-progress form state.
- CKEditor’s autosave plugin only covers individual rich-text fields, not the whole entry (dynamic zones, media, relations).

## Decision

Ship a small **admin-only plugin** (`browser-draft-recovery`) that runs **invisibly** in the Content Manager edit view (no editor UI — console logs only for verification):

1. While the form is **dirty**, snapshot `form.values` to **localStorage** on a short debounce after edits, every 15s, on tab hide, and on `beforeunload`.
2. **Skip write** if the fingerprint matches the last successful snapshot (no identical re-writes).
3. **Soft max payload** (`MAX_PAYLOAD_CHARS` ≈ 2.5MB per entry) plus handling of browser **quota** errors; failures are console-warned.
4. On load, if a stored draft **differs from** `form.initialValues`, **auto-restore** via `setValues` once.
5. Clear the browser draft when the form transitions **dirty → clean**.
6. On create → first Save, **re-key** any draft under documentId `create` to the real Strapi `documentId` while still dirty.

Keys are scoped by `model + documentId + locale`. Autosave is skipped when the document id cannot be resolved (`unknown`). Log prefix: `[browser-draft-recovery]`.

## Alternatives considered

| Option                                        | Why not (now)                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Enable Draft & Publish + interval server save | Large product/schema change; still needs custom polling; MDX export lifecycles would fire more often |
| Official Strapi autosave                      | Does not exist for full edit forms                                                                   |
| Third-party autosave plugin                   | No viable published package for Strapi 5                                                             |
| CKEditor autosave only                        | Leaves dynamic zone structure and non-CKE fields unprotected                                         |
| Manual restore UI in the edit view            | Editors want automatic recovery without extra chrome                                                 |

## Things already handled in code

| Concern                | Approach                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Oversized single entry | Soft max `MAX_PAYLOAD_CHARS` (~2.5MB); skip write and console-warn                                       |
| Browser storage quota  | Catch `QuotaExceededError` / code 22; warn, do not throw                                                 |
| Identical re-writes    | Fingerprint via `stableStringify`; skip if unchanged since last successful write                         |
| Key collisions         | Scope by `model + documentId + locale` under `ilf:strapi-browser-draft:`                                 |
| Unresolved document id | Skip autosave when id is `unknown`                                                                       |
| Create → first Save    | Re-key draft from documentId `create` to the real Strapi `documentId` while still dirty                  |
| Flush before leave     | Snapshot on `visibilitychange` (hidden) and `beforeunload` in addition to debounce + 15s interval        |
| Clear after real Save  | Drop browser draft when form transitions dirty → clean                                                   |
| Restore timing         | Skip auto-restore for existing entries until Content Manager has loaded non-empty `initialValues`        |
| Key isolation          | Restore only the exact `model + documentId + locale` key — never apply a create draft onto another entry |

## Things to consider (open risks / product caveats)

These are accepted for v1 or deferred; keep them in mind when debugging recovery or extending the plugin.

### Auto-restore vs intentional discard

There is **no Discard button**. After a hard reload (or crash recovery), if a stored draft differs from `form.initialValues`, we **auto-restore once**. That is the point for crash recovery, but it means:

- An editor who wanted to abandon in-progress edits and start from the last server Save will get the local draft back on reload.
- True abandon paths today: click **Save** after restoring then re-edit; clear site data for the admin origin; or remove the relevant `localStorage` key in DevTools.

If product later wants “reload = server state,” we need either a confirm dialog before restore or an explicit Discard that clears storage without saving.

### Multi-tab / multi-window

`localStorage` is shared across tabs on the same origin. There is **no lock**:

- Two tabs editing the same `model + documentId + locale` will overwrite each other’s drafts (last write wins).
- Tab A can restore Tab B’s newer (or older) snapshot depending on timing.
- Saving in one tab clears the draft key for that entry; the other tab’s in-memory form is unaffected until it reloads.

Mitigations if this bites us: `storage` event listeners, a simple lock token with heartbeat, or “last writer only if newer `savedAt`.”

### Stale local draft vs newer server content

Recovery compares the stored draft to **this tab’s** `form.initialValues` (what the CM loaded from the API), not to a global version clock.

- Editor Saves on machine B → machine A still has an older local snapshot → opening the entry on A may **auto-restore the older local draft** over the fresher server content until they Save on A (which clears the draft).
- Conversely, if initialValues already match the draft fingerprint, we skip restore (no-op).

No `updatedAt` / revision check against Strapi is implemented.

### `setValues` fidelity (experimental CM API)

We rely on `unstable_useContentManagerContext` and `form.setValues`. Risks:

- Dynamic zones, repeatable components, and custom fields (CKEditor included) may not fully rehydrate from plain JSON the way a fresh API load would.
- Internal form meta (touched flags, validation state, component UIDs) may desync after a bulk `setValues`.
- Strapi may change or remove the unstable CM hooks in a future minor.

Treat full-form restore as best-effort; field-level bugs should be verified against current Strapi admin before blaming storage.

### Media, relations, and deleted assets

We only persist what is already in `form.values` (IDs, nested objects, URLs already on the form). We do **not** re-upload files or re-fetch relation entities.

- If a media asset is deleted from the Media Library after the draft was stored, restore can leave broken references.
- Relation targets that no longer exist behave the same as any stale ID in the form.

### Privacy / PII in localStorage

Draft payloads are **plaintext in the browser** (not encrypted, not HttpOnly).

- Shared workstations and browser profiles retain drafts until Save, clear, or manual storage wipe.
- Content that must not sit on disk unencrypted is a product/compliance concern; this plugin does not address it.
- Private / Incognito mode: storage may be ephemeral or blocked; recovery simply will not persist across sessions (or at all if `localStorage` throws).

### Total origin quota (not just per-entry max)

`MAX_PAYLOAD_CHARS` limits **one** key. Browsers typically allow on the order of **~5MB total localStorage per origin**, shared with the rest of Strapi admin and other site data.

- Many large drafts across content types can still exhaust quota even when each write is under the soft max.
- There is **no global eviction** (LRU / oldest-first) of other draft keys when a write hits quota.

### No TTL / no max age

Drafts live until:

- the form goes clean (successful Save path),
- create-key rekey removes the old key, or
- the user clears site data.

Abandoned create forms (`documentId = create`) and rarely opened entries can leave orphaned keys indefinitely. A future improvement: drop drafts older than N days on read, or cap total draft keys.

### `beforeunload` is best-effort

Browsers throttle or skip synchronous work on unload; mobile browsers are especially unreliable. We also snapshot on tab hide and on an interval so unload is not the only flush path—but a hard kill of the browser process can still lose the last few seconds of typing after the last successful write.

### Create-entry edge cases

- Multiple simultaneous “create” forms for the same content type and locale share one `create` key (last writer wins).
- If the editor abandons create without saving, the `create` draft remains and may auto-restore the next time they open Create for that type/locale.
- Rekey runs when `documentId` transitions from `create` to a real id while still dirty; if that transition is missed (unusual CM navigation), a draft can remain under `create` only.

### What this is not

- Not multi-user collaboration or cross-device sync.
- Not a replacement for Draft & Publish or server-side autosave.
- Not Content History (which only stores already-saved versions).
- Not a guarantee that every field type restores pixel-perfectly after a crash.

## Consequences

- Editors get a practical crash net without enabling Draft & Publish or extra UI.
- They must still click **Save** for content to reach the API/MDX pipeline.
- Console-only logging (`[browser-draft-recovery]`) is enough to verify autosave/restore in DevTools; no side panel or right-links UI chrome for editors.
- Follow-ups if product needs them: confirm-before-restore or Discard, multi-tab locks, IndexedDB + larger payloads, TTL / global eviction, optional encryption or “don’t store” flag for sensitive types.
