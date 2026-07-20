# ADR-007: Dependency-aware ordering in the MDX → Strapi sync

**Status:** Accepted
**Date:** 2026-07-18
**Issue:** INTORG-856

---

## Context

Every PR runs a check called `build-and-dryrun`, which does a **dry run** of syncing the PR's MDX content into Strapi — it validates that the sync would succeed, without actually writing anything. If content in the PR can't be turned into valid Strapi data (a broken image reference, a broken relation to another page, etc.), this check catches it before merge.

Until recently, this dry run compared the PR's content against **whichever Strapi instance was already running on staging or playground** — a long-lived instance that had already been populated by every previous merge. Because that instance already contained essentially everything (existing profiles, existing pages), a PR's dry run would basically always find what it was looking for, regardless of the exact order in which the sync script processed things internally. Ordering was never a variable that mattered.

A separate fix (PR #399) changed this: instead of comparing against that long-lived, already-populated instance, `build-and-dryrun` now spins up a **brand-new, empty Strapi instance from scratch**, built from the PR's own branch, runs the dry run against it, and throws it away afterwards. This is the more correct comparison — it validates the PR's content on its own terms rather than against however staging happens to look that day. But it also removed a hidden safety net: **an empty database has nothing in it yet**, so if the sync script processes things in the wrong order, a page that references another piece of content can be checked before that other content has been created — and the check now fails.

### Why order suddenly matters

The sync script (`syncAll` in `cms/scripts/sync-mdx/syncCoordinator.ts`) processes every content type — `profiles`, `faqs`, `reports`, `grant-pages`, `grant-overview-pages`, `foundation-pages`, `summit-pages`, `foundation-blog-posts` — **at the same time**, via `Promise.all`. This was itself a deliberate, separate fix (PR #337) that replaced a slower, fully sequential loop, purely for speed.

Running everything at once is fine as long as content types don't reference each other. But they can: MDX authors can embed a `<ProfileCard pathSlug="..." />` or `<ProfileGrid pathSlugs={[...]} />` inside a grant page, blog post, or other page type, to pull in a person's profile. When the sync script hits one of these, it looks up that profile by its pathSlug directly against Strapi (`resolveRelation` in `cms/scripts/sync-mdx/profileHandler.ts`, which calls `strapi.findByPathSlug`) to get its ID. That lookup only succeeds if the profile has *already* been written to Strapi by the time the lookup happens.

`profiles` is the only content type ever looked up this way — nothing in the codebase does the reverse (a profile referencing a grant page, for example). So there's exactly one thing to get right: **profiles need to exist before anything that might reference them gets checked.**

On the old, always-already-populated staging instance, this was never a problem — the profile in question was virtually always already there from a previous merge, so it didn't matter whether `profiles` had "finished" in this particular run or not. On a brand-new empty instance, though, a PR that adds both a new profile *and* a new page referencing that profile in the same PR creates a genuine race: if the page's content gets checked before the new profile has been written, the lookup fails — even though the profile is right there in the same PR and would resolve fine on a second pass.

### The failure, concretely

A PR added a new grant page (`education/on-campus`) that displays a grid of fellows' profiles, including one for a brand-new fellow, `lawil-karama`, added in the very same PR. The dry run failed with:

```
❌ Error processing education/on-campus (en): [parser] [education/on-campus] [parser]
pathSlug "grant/fellowship/lawil-karama" could not be resolved for "profile-pages"
in locale "en" or "en".
```

This didn't fail consistently — it depended on which of the concurrent `Promise.all` tasks happened to finish creating the profile first on that particular run. That inconsistency (same PR, sometimes passes, sometimes fails) was itself a strong signal that this was a timing race rather than a real content problem.

---

## Decision

Make `syncAll` finish syncing `profiles` completely **before** starting any of the other content types. Everything else still runs concurrently among itself, exactly as before — only `profiles` gets a head start:

```ts
// profile-pages is the only relation target other content types reference
// (ProfileCard/ProfileGrid resolve a profile pathSlug via a live Strapi
// lookup — see profileHandler.ts). It must finish syncing first: on a
// brand-new Strapi instance, a content type and the profile it references
// can both be new in the same run, so syncing everything concurrently
// races the referencing entry against the profile it depends on.
const RELATION_TARGET_TYPE = 'profiles' as const

export async function syncAll(ctx: SyncContext, dryRun: boolean) {
  const contentTypes = Object.keys(ctx.contentTypes) as Array<keyof ContentTypes>
  const dependents = contentTypes.filter((t) => t !== RELATION_TARGET_TYPE)

  if (contentTypes.includes(RELATION_TARGET_TYPE)) {
    addResults(allResults, await syncContentTypeSafely(RELATION_TARGET_TYPE, ctx, dryRun))
  }

  const perTypeResults = await Promise.all(
    dependents.map((contentType) => syncContentTypeSafely(contentType, ctx, dryRun))
  )
  // ...
}
```

This is a one-off fix for a single known dependency, not a general dependency-resolution system — because right now there's only one dependency in the whole content model: everything else can point at `profiles`, and `profiles` never points back. If a second cross-content-type reference is ever introduced, this specific fix won't automatically cover it (see **Consequences**).

This isn't a CI-only fix — `syncAll` is the same function the real, production-facing sync uses (`merge.yml`'s `sync-to-strapi` job, which syncs every push to `staging`/`playground` into the real Strapi instance there). The same race was always theoretically possible during a real merge too; it just never showed up in practice, because a real merge is almost always syncing into an instance that already has the referenced profile from an earlier merge. This fix removes that theoretical risk everywhere `syncAll` runs, not just in CI.

Commit: `ac4cf213` — *"syncAll awaits for relations to be synced first — concurrency fix"*.

### A second bug, found immediately after, from the same underlying cause

Fixing the ordering surfaced a *different* failure for the exact same content:

```
⚠️  [DRY-RUN] Relation "grant/fellowship/lawil-karama" (profile-pages)
    not yet in Strapi — would be created by this same sync run.
```

Here's why: even with `profiles` now guaranteed to go first, **a dry run never actually writes anything to Strapi, by design** — that's the whole point of "dry run." So even after the `profiles` step logs `✅ [DRY-RUN] Would create: grant/fellowship/lawil-karama`, no such profile actually exists in the database — there's nothing for the grant page's lookup to find. Fixing the *order* things happen in doesn't change the fact that dry-run mode never persists anything for a later step to find, regardless of order.

The fix mirrors one already in place for images: when a relation lookup comes up empty, and we're in dry-run mode, check whether that pathSlug exists among the profile MDX files being synced in this same run. If it does, treat it as "would resolve, once this run actually applies" instead of a hard failure:

```ts
if (dryRun && dryRunPathSlugs?.has(pathSlug)) {
  console.log(
    `   ⚠️  [DRY-RUN] Relation "${pathSlug}" (${apiId}) not yet in Strapi — would be created by this same sync run.`
  )
  return { documentId: `dry-run:${apiId}:${pathSlug}` }
}
```

(`createRelationResolver` in `cms/scripts/sync-mdx/profileHandler.ts`; the pathSlug set is computed once via `scanMDXFiles('profiles', contentTypes)` in `cms/scripts/sync-mdx/config.ts`.) This exactly parallels `createMediaUploadResolver`'s existing behavior for images: an image that doesn't exist in Strapi yet, but does exist on disk, is treated as "would resolve" rather than broken. The placeholder `documentId` returned here is never actually sent anywhere, since dry-run mode never sends any payload to Strapi in the first place.

Commit: `f5d557ab` — *"syncAll - resolveRelation needed the same dry-run tolerance as resolveMediaUpload"*.

---

## Alternatives considered

**Go back to syncing every content type one at a time (undo PR #337).** Would have fixed the race, since nothing would ever run before its dependencies. Rejected because it throws away a real, deliberate performance improvement — a fully sequential sync noticeably slows down both this CI check and every real merge, and that slowdown only gets worse as more content is added.

**Build a general dependency graph / topological sort.** More rigorous in the abstract, but there is currently exactly one dependency relationship in the entire content model (`profiles` gets referenced by other types; nothing else is referenced this way). Building generic multi-level dependency-resolution machinery for a single relationship is over-engineering for a problem that doesn't exist yet. Worth revisiting if a second such relationship is ever added.

**Retry failed relation lookups a few times before giving up.** Would make the race less likely to actually surface, without actually fixing it — still flaky under different timing, and adds delay to every sync (CI and real merges alike) to paper over a problem that has an exact, known cause.

---

## Consequences

**Positive**

- Both this CI check and real syncs to staging/playground are now safe from the "new page references a new profile in the same PR" race, regardless of timing or processing order.
- A PR that adds both a new profile and a page referencing it now correctly shows "would create" for both, instead of a misleading, intermittent failure.
- Covered by tests: `cms/scripts/sync-mdx/syncCoordinator.test.ts` proves `profiles` always finishes before any other content type starts (even when profiles is deliberately made the slowest); new cases in `cms/scripts/sync-mdx/profileHandler.test.ts` cover the dry-run placeholder behavior and confirm real (non-dry-run) syncs are unaffected.

**Negative / watch for**

- **This only covers the one dependency that exists today.** The fix hardcodes `profiles` as the thing that must go first. If a second cross-content-type reference is ever added — say, a grant page referencing a grant-overview page by pathSlug — this fix does **not** automatically protect it. Whoever adds that needs to either extend this into a proper multi-stage ordering, or explicitly check whether the new reference is safe under the current "one type goes first" approach.
- **Within a single content type, files are still processed in plain file order, not dependency order.** If a profile page ever needed to reference *another* profile page (e.g., a "related team members" grid on a profile itself), and both were new in the same PR, this same race could reappear — just one level down, within `profiles` instead of between content types. This doesn't happen anywhere in the current content (checked: no file under `src/content/profiles/` uses `ProfileCard`/`ProfileGrid`), but it's worth remembering if that ever changes.
- The placeholder value returned for an unresolved dry-run relation (`"dry-run:<apiId>:<pathSlug>"`) is not a real Strapi ID — it must never end up in a payload that's actually sent to Strapi. This is safe today because dry-run mode blocks every write, but any future change to how dry-run enforces that boundary needs to preserve this.

---

## How to reproduce / verify locally

1. `cd cms && rm -rf .tmp && DATABASE_FILENAME=.tmp/repro.db pnpm run start` — boots Strapi against a brand-new, empty database, the same starting condition as the CI check.
2. In another shell, get an API token for it (see `ensureCiApiToken` in `cms/src/index.ts`, or create one manually via the admin panel).
3. `STRAPI_URL=http://localhost:1337 STRAPI_API_TOKEN=<token> pnpm run sync:mdx:dry-run`.
4. If you ever see `❌ Error processing ... could not be resolved for "profile-pages"` again, this ordering fix (or the dry-run fallback described above) has regressed — start there.
