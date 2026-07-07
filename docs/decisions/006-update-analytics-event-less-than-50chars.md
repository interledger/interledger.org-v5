# ADR-006: Label-first event names with grouped path properties

**Status:** Proposed
**Date:** 2026-07-06
**Supersedes:** ADR-005
**Issue:** N/A

---

## Context

Umami event tracking had grown inconsistent and hard to query, for four reasons carried over from ADR-005: events were named by hand and drifted into inconsistent variants; over-specific, date-stamped events (`Blog - 2026-01-07`) produced near-unique names that couldn't be grouped; there was no enforced separation between page context, component, and destination; and naming didn't reflect the site's reusable Astro components or `locales` export. ADR-005 addressed all four with a `{page}:{component}:{label}` schema generated from code and content identifiers rather than typed by hand.

That schema has a fatal flaw: on long detail-page slugs it overflows Umami's 50-character event name cap, producing unpredictable event names, dropping useful information, and creating inconsistent labels that break aggregation. Any replacement schema must guarantee that every generated name fits within the cap, while still respecting the constraint that shaped ADR-005 in the first place: Umami's UI treats the event name as the primary filter and properties as a secondary breakdown, so page context needs to stay queryable even once it's no longer part of the name.

This proposal has the event label encode **what kind of interaction this is**, and uses event properties to convey **where it happened and where it goes**. Page details no longer need to live in the event name, since page-level filtering can be handled through segments in Umami instead.

The trade-off: we lose the ability to filter on destination directly, but gain better aggregate information — we can compare which components generate the most interaction, see which page groups drive the most engagement, and see which CTAs are getting clicked and attracting the most attention.

---

## Decision

### Event name: `{label}` only

| Label         | Has destination? | Covers                                                                                                                                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `button_cta`  | yes              | `primary_cta`, `secondary_cta`, `hero`, `cta_strip`, `download_button`                                                                                                                     |
| `button_card` | yes              | `nav_cards`, `resource_cards`, `event_cards`, `tile_cards`                                                                                                                                 |
| `button_form` | yes              | `form`                                                                                                                                                                                     |
| `button_ui`   | sometimes        | Destination-bearing sitewide UI controls — `language_switcher` and `pagination`, whose "destination" is a target locale or the next set of content rather than a new page.                 |
| `nav`         | yes              | `menu`, `footer`                                                                                                                                                                           |
| `toggle`      | no               | Bare, in-page, destination-less state changes: `faq` expand/collapse, mobile `hamburger_menu` drawer open/close, desktop `submenu` dropdown expand/collapse, `carousel` prev/next/dot-nav. |
| `link`        | yes              | `inline_link` — a link inside rich-text/editor-driven body content (paragraph).                                                                                                            |

Every link-click label is prefixed `button_`, so a segment or breakdown built on `Event contains "button_"` catches every destination-bearing interaction in one query, while `toggle` and `link` stay bare since neither is a destination-bearing chrome link.

As in ADR-005, rich text is a deliberate exception: body content is editor-driven and open-ended, so encoding every inline destination into its own name would produce a large, unstructured, low-volume tail that clutters the Umami event list. A custom Markdown link renderer still intercepts every link at build time and stamps on the tracking attributes automatically — it now emits the flat `link` label with `inline_link` as `base_component`, rather than the `{page}:{component}` pair ADR-005 used.

### Properties on every event

| Property              | Description                                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_component`      | Fine-grained variant: `primary_cta`, `secondary_cta`, `cta_strip`, `nav_cards`, `resource_cards`, `event_cards`, `tile_cards`, `profile_grid`, `hero`, `form`, `menu`, `footer`, `inline_link`, `language_switcher`, `pagination`, `faq`, `hamburger_menu`, `submenu`, `carousel`, `timeline`, `podcast`, etc. |
| `link_text`           | Visible text, falling back to `aria-label`. Null for icon/image-only links.                                                                                                                                                                                                                                    |
| `lang`                | Locale of the current page.                                                                                                                                                                                                                                                                                    |
| `current_path`        | Grouped, cleaned path of the page the event fired on (see below). Always internal — the page itself is always on-site.                                                                                                                                                                                         |
| `current_section`     | `foundation` \| `summit` \| `hackathon`                                                                                                                                                                                                                                                                        |
| `destination_path`    | Grouped, cleaned path or domain of the link target (see below).                                                                                                                                                                                                                                                |
| `destination_section` | `foundation` \| `summit` \| `hackathon` \| `external`                                                                                                                                                                                                                                                          |

### Path grouping algorithm — `normalizePath(rawPath)`

1. If the path is external, check whether the domain matches one of a fixed set of special cases; if so, resolve to that name, otherwise resolve to `other_external`. The special cases are: `tito`, `submittable`, `github`, `webmonetization`, `openpayments`, `rafiki`, `learn.interledger`, `wallet`, `slack`, `x`, `linkedin`, `youtube`, `instagram`, `facebook`, `mastodon`.
2. If the path is internal, strip `https://`, `http://`, `www`, and any URL parameters.
3. Strip the locale prefix using the project's `locales` export — exact match only, never pattern-matched (`go`, `do` are not locales).
4. Strip the literal `summit` and `hackathon` segments.
5. From what remains, drop any purely numeric or date-shaped segments (`2026`, `2026-01`, etc.). These identify an _edition_, not a _content type_ — exactly the long-tail granularity this grouping is meant to collapse.
6. If nothing remains, return `{section}_home`.
7. Otherwise, take the **first** remaining segment as the grouped value (e.g., extracting `blog`, `grant`, or `policy-and-advocacy`).

This list of special-case domains will need ongoing maintenance as new destinations are added.

### Examples

| Input                                      | `current_path` / `destination_path` | `section`    |
| ------------------------------------------ | ----------------------------------- | ------------ |
| `/`                                        | `foundation_home`                   | `foundation` |
| `/es/grant/fellowship/sheena-allen`        | `grant`                             | `foundation` |
| `/blog/thoughts-on-scaling`                | `blog`                              | `foundation` |
| `/summit`                                  | `summit_home`                       | `summit`     |
| `/summit/hackathon/2026/judges/jane-doe`   | `judges`                            | `hackathon`  |
| `/summit/2024/speakers/sheena-allen`       | `speakers`                          | `summit`     |
| `https://github.com/interledger/rafiki`    | `github`                            | `external`   |
| `https://submittable.com/...`              | `submittable`                       | `external`   |
| `https://openpayments.dev/...`             | `openpayments`                      | `external`   |
| `https://linkedin.com/company/interledger` | `linkedin`                          | `external`   |

---

### Implementation

As in ADR-005, none of this is hand-typed. Labels, `base_component`, and the grouped path properties are generated at build time from code and content identifiers through a single shared instrumentation point, so casing drift and copy-paste duplication stay structurally impossible. `lang` is still populated from `Astro.currentLocale`, and `link_text` still falls back to `aria-label`, resolving to `null` for icon/image-only links — unchanged from ADR-005.

---

## Alternatives considered

**Three-segment name with a detail-page allow-list.** Fixes the character cap, but produces unreadable names and requires manual maintenance and ongoing awareness of the allow-list.

**Encoding destination in the name for funnel-ability.** Considered, since destination isn't filterable as a property and therefore can't be a hard funnel/segment condition. Ruled out for now because the two-step funnel pattern (Viewed page → Triggered event) already answers the actual stated use case ("land on X, then click X's CTA") without it. If a future report genuinely needs "specifically clicked through to Submittable" as a filterable condition rather than an eyeballed property breakdown, that's the trigger to give that one component a destination-bearing name — not a reason to put destination in every name now.

**Selective tracking.** Not revisited here — ADR-005 already rejected tracking fewer events upfront, since analytics questions are usually retrospective and a link that was never tracked can never be reconstructed later. That reasoning still holds: this schema keeps the event set finite and predictable (bounded components) or collapsed to a single flat label (rich text), so capturing everything remains cheap to ignore and costly to have missed.

---

## Consequences

**Positive**

- Names and properties are still generated at build time from code and content identifiers, never typed by hand — the casing drift and copy-paste duplication ADR-005 set out to fix remain structurally impossible.
- Names are short (`button_cta`, `faq`) — the 50-character cap is never a design constraint again.
- Funnels work via chained Path + Event steps; the page never needs to be encoded in the name.
- `Event contains "button_"` gives a one-query view of all destination-bearing interactions across the whole site.
- `base_component` gives Dev/Design their component-comparison view directly, with no name design required.
- Grouped `current_path`/`destination_path` keep trend breakdowns readable instead of producing a long tail of near-unique paths.
- Additive by default, as in ADR-005 — no central registry of event names to maintain by hand.

**Negative**

- Destination is not filterable — only viewable per-event via the Properties tab. If a page has two destination-bearing components sharing a label (e.g., two `button_cta` instances on the same page pointing at different destinations), you cannot isolate them in a segment or funnel; you can only see both in that event's destination breakdown.
- `button_ui`'s `base_component` vocabulary is a placeholder pending further UI-element review; expect it to grow, which is fine since it's a property, not a name segment.
- As in ADR-005, the shared instrumentation point must be adopted across every component for these consistency benefits to hold — a manually authored `data-umami-event` attribute still bypasses generation entirely.
- Rich text instrumentation still depends on the build-time Markdown link renderer running correctly, unchanged from ADR-005.
