# ADR-006: Label-first event names with grouped path properties

**Status:** Proposed
**Date:** 2026-07-06
**Supersedes:** ADR-005
**Issue:** N/A

---

## Context

ADR-005's `{page}:{component}:{label}` schema has some fatal flaws: it overflows Umami's 50-character event name cap on long detail-page slugs, producing unexpted event lables, missing useful info and causing inconsistent lables that break aggregation. The schema must guarantee every generated name fits within the cap. The proposal here is for the event label to encode **what kind of interaction this is** and rather use event properties to convey **where it happened and where it goes**. Page details do not need to live in the event name since page-level filtering can be handled through segments on Umami. We lose the abilty to filter on destination but we get better aggregate information to compare which components are generating high interaction compared to others, we can see which page groups are generating the most interactions, we can see if our CTAs are successfully being clicked and which CTAs are getting the most attention.

---

## Decision

### Event name: `{label}` only

| Label         | Has destination? | Covers                                                                                                                                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `button_cta`  | yes              | `primary_cta`, `secondary_cta`, `hero`, `cta_strip`, `download_button`                                                                                                                     |
| `button_card` | yes              | `nav_cards`, `resource_cards`, `event_cards`, `tile_cards`                                                                                                                                 |
| `button_form` | yes              | `form`                                                                                                                                                                                     |
| `button_ui`   | sometimes        | Destination-bearing sitewide UI controls — `language_switcher` and `pagination`, whose "destination" is a target locale or next set of content rather than a new page.                     |
| `nav`         | yes              | `menu`, `footer`                                                                                                                                                                           |
| `toggle`      | no               | Bare, in-page, destination-less state changes: `faq` expand-collapse, mobile `hamburger_menu` drawer open-close, desktop `submenu` dropdown expand-collapse, `carousel` prev/next/dot-nav. |
| `link`        | yes              | `inline_link` link inside rich-text/editor-driven body content (paragraph).                                                                                                                |

Every link-click label is prefixed `button_`, so a segment or breakdown built on `Event contains "button_"` catches every destination-bearing interaction in one query, while `toggle`/`link` stay bare since none of them are destination-bearing chrome links.

### Properties on every event

| Property              | Description                                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_component`      | Fine-grained variant: `primary_cta`, `secondary_cta`, `cta_strip`, `nav_cards`, `resource_cards`, `event_cards`, `tile_cards`, `profile_grid`, `hero`, `form`, `menu`, `footer`, `inline_link`, `language_switcher`, `pagination`, `faq`, `hamburger_menu`, `submenu`, `carousel`, `timeline`, `podcast`, etc. |
| `link_text`           | Visible text, falling back to `aria-label`. Null for icon/image-only links.                                                                                                                                                                                                                                    |
| `lang`                | **Current** page locale.                                                                                                                                                                                                                                                                                       |
| `current_path`        | Grouped, cleaned path of the page the event fired on (see below). Always internal — the page itself is always on-site.                                                                                                                                                                                         |
| `current_section`     | `foundation` \| `summit` \| `hackathon`                                                                                                                                                                                                                                                                        |
| `destination_path`    | Grouped, cleaned path or domain of the link target (see below).                                                                                                                                                                                                                                                |
| `destination_section` | `foundation` \| `summit` \| `hackathon` \| `external` \|                                                                                                                                                                                                                                                       |

### Path grouping algorithm — `normalizePath(rawPath)`

1. If the path is external, check if the domain matches a set list of special cases, in which case it will resolve to that, otherwise it will simply resolve to `other_external`. The special cases include `tito` \| `submittable` \| `github` \| `webmonetization` \| `openpayments` \| `rafiki` \| `wallet` \| `slack` \| `x` \| `linkedin` \| `youtube` \| `instagram` \| `facebook` \| `mastodon` \|
2. If the path is internal strip `https://`, `http://`, `www`, and strip all parameters from the URL.
3. Strip the locale prefix using the project's `locales` export — exact match only, never pattern-matched (`go`, `do` are not locales).
4. Strip the literal `summit` and `hackathon` segments.
5. From what remains, drop any purely numeric or date-shaped segments (`2026`, `2026-01`, etc.). These identify an _edition_, not a _content type_, and edition-level detail is exactly the kind of long-tail granularity we're trying to collapse.
6. If nothing remains, return `{section}_home`.
7. Otherwise take the **first** remaining segment as the grouped value, (we're trying to extract `blog` and `grant` and `policy-and-advocacy`)

The list of special cases will need to be maintained.

### Examples

| Input                                      | `current_path` / `destination_path` | `section`     |
| ------------------------------------------ | ----------------------------------- | ------------- |
| `/`                                        | `foundation_home`                   | `foundation`  |
| `/es/grant/fellowship/sheena-allen`        | `grant`                             | `foundation`  |
| `/blog/thoughts-on-scaling`                | `blog`                              | `foundation`  |
| `/summit`                                  | `summit_home`                       | `summit`      |
| `/summit/hackathon/2026/judges/jane-doe`   | `judges`                            | `hackathon`   |
| `/summit/2024/speakers/sheena-allen`       | `speakers`                          | `summit`      |
| `https://github.com/interledger/rafiki`    | `github`                            | `github`      |
| `https://submittable.com/...`              | `submittable`                       | `submittable` |
| `https://openpayments.dev/...`             | `openpayments`                      | `external`    |
| `https://linkedin.com/company/interledger` | `linkedin`                          | `external`    |

---

## Alternatives considered

**Two fixes to ADR-005's 50-character overflow were on the table before this draft.** One kept three name segments (`page:component:destination`) and added a hand-maintained allow-list of high-cardinality routes to collapse before the cap was hit. The other, from the Strapi component list, dropped page from the name entirely, using a small closed vocabulary (`label`) for the name and pushing everything else — `base_component`, `link_text`, `lang`, `destination_path`, `current_path` — into properties. This ADR adopts the second approach's shape, but arrived independently once we confirmed what Umami's filters and funnels actually support (see Context) — the reasoning below explains why each alternative was set aside, not just the mechanics.

**Three-segment `page:component:destination` name (ADR-005).** Ruled out — overflows the 50-char cap on real content, and is now redundant: everything it bought via wildcard filtering, native Path + Event filters already give us, more accurately.

**Three-segment name with a detail-page allow-list.** Fixes the char cap but reintroduces the exact hand-maintained-list problem ADR-005 was written to kill, and its own consequences section admits a forgotten entry fails silently. The section/numeric-stripping rule above achieves the same collapsing structurally, with a much smaller override list confined to genuine taxonomy decisions (blog-under-developers) rather than character-budget triage.

**Fully flat label-only, no path properties at all.** Considered, since it's the simplest reading of the component-list doc. Ruled out because it can't answer "what content are people engaging with" or "are we driving traffic to Submittable/docs/GitHub" as anything other than a raw, unreadable path breakdown — the grouping is what makes the property breakdown a usable trend view instead of a long tail.

**Encoding destination in the name for funnel-ability.** Considered, since destination isn't filterable as a property and therefore can't be a hard funnel/segment condition. Ruled out for now because the two-step funnel pattern (Viewed page → Triggered event) answers the actual stated use case ("land on X, then click X's CTA") without it. If a future report genuinely needs "specifically clicked through to Submittable" as a filterable condition rather than an eyeballed property breakdown, that's the trigger to give that one component a destination-bearing name — not a reason to put destination in every name now.

---

## Consequences

**Positive**

- Names are short (`button_cta`, `faq`) — the 50-character cap is never a design constraint again.
- Funnels work via chained Path + Event steps; page never needs to be encoded in the name.
- `Event contains "button_"` gives a one-query view of all destination-bearing interactions across the whole site.
- `base_component` gives Dev/Design their component-comparison view directly, no name design required.
- Grouped `current_path`/`destination_path` keep trend breakdowns readable instead of producing a long tail of near-unique paths.

**Negative**

- Destination is not filterable — only viewable per-event via the Properties tab. If a page has two destination-bearing components sharing a label (e.g. two `button_cta` instances on the same page pointing at different destinations), you cannot isolate them in a segment or funnel; you can only see both in that event's destination breakdown.
- The numeric-segment-drop and multi-segment override map are still hand-maintained, just smaller and lower-stakes than a char-budget allow-list — wrong entries produce a slightly wrong grouping, not a broken build.
- `learn` (from ADR-005's original examples table) is dropped from `destination_section` pending confirmation — a search turned up no clearly live `learn.interledger.org` subdomain, so this needs an internal check rather than an assumption either way.
- `button_ui`'s `base_component` vocabulary is a placeholder pending further UI-element review; expect it to grow, which is fine since it's a property, not a name segment.
- **Confirmed via codebase audit — real, live, currently untracked and need `buildUmamiAttrs` added (implementation work, not a schema gap):** contact form submit button (`button_form` exists on paper, not in code), in-article tag links (inconsistent with the already-tracked listing-page tag filter — both should carry the same label once fixed), language switcher, mobile hamburger toggle, desktop submenu toggle, carousel prev/next/dot nav, video embed play.
- **Confirmed via codebase audit — genuinely out of scope, no component exists, don't add rows for these yet:** site search, tabs, sort controls, table sort/filter, copy-to-clipboard, back-to-top, skip-to-content, and theme toggle. Search and theme toggle exist only inside the third-party Starlight docs shell, which this ADR already excludes.
