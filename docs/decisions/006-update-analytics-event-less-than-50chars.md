# ADR-006: Update Analytics event to fit within 50 chars

**Status:** In Review
**Date:** 2026-05-4
**Issue:** N/A

---

## Context

Umami event tracking has grown inconsistent and hard to query. Five root causes:

**Manual naming drift.** Events are named by hand, splitting the same interaction across inconsistent variants and breaking aggregation.

**Over-specific event names.** Date-stamped events like `Blog - 2026-01-07` produce near-unique names that can't be grouped.

**No ownership model.** No enforced separation between page context, component, and destination — each event is constructed ad hoc.

**Misalignment with the stack.** The site uses reusable Astro components, locale-aware paths, and a central `locales` export. The analytics layer doesn't reflect this.

**Umami's 50-character event name cap.** Umami truncates event names at 50 characters. Long detail-page slugs (e.g. `/developers/blog/thoughts-on-scaling-interledger-connectors`) blow past this and lose their tail, producing collisions and broken aggregation. The schema must guarantee every generated name fits within the cap.

Umami's UI is event-name-first: the event name is the primary filter, with properties as secondary breakdown. Page context belongs in the name — but too much detail fragments events into long-tail noise. The schema must balance queryability with clean aggregation **and** stay under 50 characters in every realistic combination.

---

## Decision

All tracked link events follow a three-segment schema, generated from code and content identifiers — never typed by hand:

```
{page}:{section}:{action}
```

Every segment is normalised: lowercased, spaces and hyphens become underscores, non-word characters are stripped. The full name is hard-capped at 50 characters; the schema is designed so the cap is never reached in normal use, but a final `.slice(0, 50)` is applied as a safety net.

### Segments

**`page`** identifies the page context. Resolution order: an explicit `umamiContext` override (from MDX frontmatter or an Astro prop) wins; otherwise it's derived from `Astro.url.pathname` via `derivePage()`. See [Page resolution](#page-resolution) below — the rules deliberately collapse high-cardinality routes to keep names short.

**`section`** is a typed enum of where on the page the link sits: `hero`, `nav`, `footer`, `card`, `cta`, `link`, `featured_content`. `link` is reserved for editor-driven inline content; the others mark bounded, intentional placements. Free-form section names are not allowed.

**`action`** describes the destination. Resolution order: an explicit `action` override (used for non-link interactions like menu toggles) wins; otherwise it's derived from the link's `href` via `deriveAction()`.

### Page resolution

`derivePage()` runs three steps:

1. **Explicit override.** If `umamiContext` is set and non-empty, normalise and return it.
2. **Detail-page collapse.** A small allow-list of high-cardinality routes collapses to a stable type segment so per-slug detail pages share a page dimension. Current rules:
   - `/blog/<slug>` → `blog_post`
   - `/developers/blog/<slug>` → `developer_post`
   - `/grant/fellowship/<slug>` → `fellowship`

   This is the primary lever that keeps names under 50 characters: without it, `/developers/blog/thoughts-on-scaling-interledger-connectors:link:…` would obviously overflow. Add a new rule whenever a new detail-page route lands.

3. **Last-two-segments fallback.** Strip the locale prefix using the project's `locales` export (never pattern-matched — `go`/`do` are not stripped). If empty, return `foundation_home`. If the path is a single microsite root (`summit`, `hackathon`), return `home` — the microsite is already implicit in Umami's URL dimension, so repeating it in the page segment is wasted characters. Otherwise take the last two segments joined with `_`.

### Action resolution

`deriveAction()` produces the action segment from an href via `deriveLabel()`, with two collapses for home links:

- Foundation root (`/`, `/es/`) → `home`.
- Microsite root from inside that microsite → `home`. From outside → `{microsite}_home` (so a foundation-page link to `/summit` reads as `summit_home`).

`deriveLabel()` itself:

- **External URLs.** `github.com/<…>` → `github_<all_path_parts>` (e.g. `github_interledger_rafiki`). Other hosts: strip `www.`, strip the TLD, keep remaining hostname parts joined with `_` (e.g. `learn.interledger.org` → `learn_interledger`, `submittable.com` → `submittable`).
- **Internal paths.** Strip locale, then either return `foundation_home` (empty), `{microsite}_home` (single microsite segment), or the last two segments joined with `_`. Two segments instead of one prevents collisions where the final segment alone is ambiguous — `/grant/fellowship/sheena-allen` and `/hackathon/judges/sheena-allen` give `fellowship_sheena_allen` and `judges_sheena_allen`.

### Examples

| Input                                               | Resolved event                           |
| --------------------------------------------------- | ---------------------------------------- |
| `/grant/fellowship` hero → submittable.com          | `grant_fellowship:hero:submittable`      |
| `/summit` nav → `/summit`                           | `home:nav:home`                          |
| `/` nav → `/`                                       | `foundation_home:nav:home`               |
| `/` footer → linkedin.com                           | `foundation_home:footer:linkedin`        |
| `/resources` inline link → docs.interledger.org     | `resources:link:docs_interledger`        |
| `/blog/<long-slug>` inline link → policy            | `blog_post:link:policy_and_advocacy`     |
| `/developers/blog/<long-slug>` inline link → github | `developer_post:link:github_interledger` |
| `/grant/fellowship/<applicant>` hero → submittable  | `fellowship:hero:submittable`            |
| `/` nav with `action: 'Menu Toggle'`                | `foundation_home:nav:menu_toggle`        |

### Properties

Three Umami properties accompany every event:

- `data-umami-event-link-text` — visible link text, falling back to `aria-label`. Empty on icon/image links.
- `data-umami-event-lang` — current locale (`en`/`es`). Locale is a property, not part of the event name, so `fellowship:hero:submittable` is the same event in both languages and `lang` distinguishes them in breakdown data.
- `data-umami-event-label` — only present when an inline-link author opts into the label-directive form (see below).

### Single instrumentation point: `buildUmamiAttrs()`

[src/utils/umami.ts](../../src/utils/umami.ts) exports `buildUmamiAttrs()` as the only sanctioned way to produce `data-umami-event*` attributes. Bounded components call it directly:

```astro
---
import { buildUmamiAttrs } from '@/utils/umami'

const { routeLocale } = Astro.locals
const attrs = buildUmamiAttrs({
  page: umamiContext, // optional override
  pathname: Astro.url.pathname,
  lang: routeLocale,
  section: 'cta',
  href,
  linkText
})
---

<a href={href} {...attrs}><slot /></a>
```

Inline links inside Markdown/MDX go through the [rehypeUmamiLinks](../../src/utils/rehypeUmamiLinks.ts) plugin, which calls the same builder at build time with `section: 'link'`. The Starlight `docs` collection is skipped (it has its own analytics surface).

### Inline content links

Editor-driven body content is open-ended, so a fully encoded `{page}:link:{action}` per inline destination would still produce a wide tail of low-volume events. Two complementary rules keep this under control:

1. **Default form: `{page}:link:{action}`.** The action is derived from the href just like bounded sections. This is fine for most cases — destinations outside body content are usually well-known external hosts or internal pages that already collapse cleanly.
2. **Author override: `{page}:link` plus a `data-umami-event-label` property.** When an inline link's destination would produce noisy or unhelpful actions, authors append a Markdown link title prefixed with `label:` — e.g. `[Community Forum](https://forum.interledger.org/ "label:community")`. The renderer extracts the directive, drops it from the rendered `title` attribute, emits the two-segment event name, and moves the destination detail into the `data-umami-event-label` property where it doesn't fragment the event list.

Use the override sparingly — only when the default action would be unhelpfully specific or noisy.

---

## Alternatives considered

**Status quo (manual event strings).** 300+ events with inconsistent casing, mixed separators, and duplicate multilingual variants. Doesn't scale.

**Single-segment label derivation.** The final path segment is frequently ambiguous. Ruled out.

**Full path as label.** Produces near-unique event names for deep pages, defeating aggregation, and routinely exceeds the 50-char cap. Ruled out.

**Encode every detail-page slug in `page`.** Most direct read of the schema, but `/developers/blog/<slug>:link:<long-action>` overflows the 50-char cap on realistic content. Detail-page collapsing is the trade-off: the slug is still available in Umami's URL dimension, so we lose nothing.

**Truncate-only (no detail-page collapse).** Relies on the 50-char `slice` to keep names valid. Two events that share a 50-char prefix would collide silently; collapsing routes upstream is structurally safer.

**Selective tracking.** Track fewer events upfront. Analytics questions are often retrospective and the cost of not capturing a link is permanent. With a schema this clean, every link fires a well-structured event that costs nothing to ignore and potentially a lot to have missed. The schema solves the noise problem structurally: bounded sections produce a finite, predictable event set; inline links collapse to `{page}:link` with `label`/`link_text` properties when the default action would fragment.

---

## Consequences

**Positive**

- Event names are generated, never typed. Casing drift and copy-paste errors are structurally impossible.
- One event per interaction regardless of language. Locale is a property, not part of the event name.
- `buildUmamiAttrs()` and the rehype plugin run at build time — no client-side cost.
- Detail-page collapsing keeps every event under Umami's 50-char cap without lossy truncation, while the slug is still recoverable from Umami's URL dimension.
- Additive by default — new bounded components pass a `section` value; new pages need at most a `umamiContext` frontmatter entry.
- Umami wildcard queries (`fellowship:*`, `*:hero:*`, `*:*:submittable`) give clean page-, section-, and destination-level views.

**Negative**

- `buildUmamiAttrs()` must be adopted across all bounded components to realise consistency benefits.
- Inline-link instrumentation requires the rehype plugin to run correctly; authors need to know about the `label:` title directive when the default action is too noisy.
- New high-cardinality detail-page routes need an entry in `DETAIL_PAGE_RULES` to keep names short. Forgetting one will quietly produce long, slug-bearing event names that get truncated at 50 characters.
