# ADR-005: Analytics event tracking schema

**Status:** Accepted
**Date:** 2026-04-21
**Issue:** N/A

---

## Context

Umami event tracking has grown inconsistent and hard to query. Four root causes:

**Manual naming drift.** Events are named by hand, splitting the same interaction across inconsistent variants and breaking aggregation.

**Over-specific event names.** Date-stamped events like `Blog - 2026-01-07` produce near-unique names that can't be grouped.

**No ownership model.** No enforced separation between page context, component, and destination — each event is constructed ad hoc.

**Misalignment with the stack.** The site uses reusable Astro components, stable `pathSlug` identifiers, and a `locales` export. The analytics layer doesn't reflect this.

Umami's UI is event-name-first: the event name is the primary filter, with properties as secondary breakdown. Page context belongs in the name — but too much detail fragments events into long-tail noise. The schema must balance queryability with clean aggregation.

**Hard constraint:** Umami's `/api/send` endpoint rejects any event whose `name` exceeds **50 characters** (yup validation, returns `400`). Long path segments combined with destination slugs blow past this limit silently — the click is dropped, and there's no signal in the dashboard. The schema must keep generated event names well under 50 chars even on deep pages with long titles.

---

## Decision

All tracked link events follow a three-segment schema, generated from code and content identifiers — never typed by hand:

```
{page}:{component}:{label}
```

### Segments

**`page`** is derived from the page’s `pathSlug` defined in MDX frontmatter, which is the stable identifier.

**`component`** is defined by the Astro component rendering the link (via a local `const COMPONENT`).

**`label`** is derived at build time from the link's `href`.

The `page` and `label` segments are both derived by `deriveLabel()` — the same rules apply in both contexts. For external links, subdomains are preserved — `learn.interledger.org` stays `learn_interledger`, not just `interledger`. `www` is stripped and the TLD is always dropped. For GitHub URLs, `github` is prepended to org and repo (e.g. `github.com/interledger/rafiki` → `github_interledger_rafiki`). All output is lowercase, spaces and hyphens become underscores, and non-word characters are stripped.

### Label resolution rules

For internal paths, resolution follows two steps in order:

1. **Strip locale prefix** — using the project's `locales` export as the source of truth. `/es/grants/fellowship` becomes `grants/fellowship`. Never pattern-matched — a two-letter segment that isn't a locale (e.g. `go`, `do`) is never stripped.

2. **Resolve the label** — if the remaining path is empty, return `foundation_home`. If every remaining segment is a microsite name (`summit`, `hackathon`), return `{last_segment}_home` — so `/summit/hackathon/` resolves to `hackathon_home`. Otherwise, take the last two segments as normal. Microsites are not stripped from longer paths — `/summit/2022` resolves to `summit_2022`, and `/summit/speakers/sheena-allen` resolves to `speakers_sheena_allen`.

Two segments instead of one prevents collisions where the final segment alone is ambiguous. `/grants/fellowship/sheena-allen` and `/hackathon/judges/sheena-allen` both end in `sheena-allen` — two segments gives `fellowship_sheena_allen` and `judges_sheena_allen`.

| Path / URL                                | Resolved label              |
| ----------------------------------------- | --------------------------- |
| `/`                                       | `foundation_home`           |
| `/es/`                                    | `foundation_home`           |
| `/summit`                                 | `summit_home`               |
| `/es/summit`                              | `summit_home`               |
| `/summit/hackathon`                       | `hackathon_home`            |
| `/grants/fellowship`                      | `grants_fellowship`         |
| `/es/grants/fellowship`                   | `grants_fellowship`         |
| `/grants/fellowship/sheena-allen`         | `fellowship_sheena_allen`   |
| `/summit/speakers/sheena-allen`           | `speakers_sheena_allen`     |
| `/hackathon/judges/sheena-allen`          | `judges_sheena_allen`       |
| `/summit/hackathon`                       | `hackathon_home`            |
| `/summit/2022`                            | `summit_2022`               |
| `/summit/hackathon/resources`             | `hackathon_resources`       |
| `https://github.com/interledger/rafiki`   | `github_interledger_rafiki` |
| `https://github.com/interledger`          | `github_interledger`        |
| `https://wallet.interledger-test.dev/...` | `wallet_interledger_test`   |
| `https://learn.interledger.org/...`       | `learn_interledger`         |
| `https://submittable.com/...`             | `submittable`               |

### Detail-page collapsing (page segment only)

High-cardinality detail and listing routes — every speaker, every talk, every blog post — would each produce a unique `page` segment under the generic two-segment rule (`speakers_sabine_schaller`, `talks_meet_your_new_friend_rafiki`, …). Two problems:

- **Cardinality.** The `page` dimension is the primary filter. It should be a small enum of page **types**, not page **instances**. The specific instance is already captured in Umami's `url` field, so duplicating it in the event name buys nothing.
- **The 50-char cap.** Long instance names (e.g. `speakers_sabine_schaller` = 24 chars) combined with `:section:` (6+) and a destination slug routinely push events past 50 chars and silently drop.

For these routes the **page segment** collapses to a stable type-name. This applies to the `page` segment only — when the same route appears as a click target, the destination `label` continues through full `deriveLabel` resolution so the action still identifies the specific instance.

| Route                            | Collapsed `page`  |
| -------------------------------- | ----------------- |
| `/summit/<year>/speakers/<slug>` | `summit_speaker`  |
| `/summit/<year>/speakers`        | `summit_speakers` |
| `/summit/<year>/talks/<slug>`    | `summit_talk`     |
| `/summit/<year>/talks`           | `summit_talks`    |
| `/blog/<slug>`                   | `blog_post`       |
| `/developers/blog/<slug>`        | `developer_post`  |
| `/grant/fellowship/<slug>`       | `fellowship`      |

So a card click on Sabine's speaker page that links to a long-titled session resolves as `summit_speaker:card:2022_session_title` — page filterable by type, action filterable by click-type (which element on the card was clicked), link-text and URL preserved as event data for instance-level drill-down.

### Literal action labels for high-cardinality destinations

When a component links to a high-cardinality destination (every speaker, every talk, every blog post), passing the destination slug through `deriveLabel` produces a unique action per instance — duplicating identity that's already in `data-umami-event-link-text` and the URL, and pushing the event past the 50-char cap on long titles.

For these cases the component overrides `action` with a stable literal that describes **the click type**, not the click destination. The destination identity stays in link-text and URL.

| Component                     | Action                 | What it identifies                        |
| ----------------------------- | ---------------------- | ----------------------------------------- |
| `SessionCard`, `SessionsList` | `{year}_session_title` | Title link on a session card              |
| `SpeakerCard`                 | `{year}_speaker_name`  | Whole-card link wrapping the speaker name |
| `BlogIndex*` (title link)     | `post_title`           | Title link on a blog post card            |
| `BlogIndex*` (read more link) | `post_read_more`       | "Read more" link on a blog post card      |

The convention: when there's only one tracked link per card, the literal describes the visible textual identity of that link (`_title`, `_name`). When a card has multiple tracked links, each gets its own literal that distinguishes them (`_title` vs `_read_more`). Year prefixes are kept where the route is year-scoped (summit) so dashboards can compare across years without filtering by URL.

### TrackedLink component

Single instrumentation point for all bounded link interactions across all three microsites.

```astro
---
// src/components/TrackedLink.astro
import { deriveLabel } from '../lib/tracking'

interface Props {
  pathSlug: string
  component: string
  href: string
  linkText?: string
}

const { pathSlug, component, href, linkText } = Astro.props
const event = `${deriveLabel(pathSlug)}:${component}:${deriveLabel(href)}`
---

<a
  href={href}
  data-umami-event={event}
  data-umami-event-lang={Astro.currentLocale}
  data-umami-event-link-text={linkText}
  {/* undefined for icon/image links */}
>
  <slot />
</a>
```

Every link gets `lang` from `Astro.currentLocale` and `link_text` from the visible label. `fellowship:hero:submittable` is the same event in English and Spanish — `lang` distinguishes them in breakdown data.

### Rich text exception

Body content is editor-driven and open-ended. Encoding every inline destination into the event name produces a large, unstructured family of low-volume events that clutters the Umami event list.

Rich text links use a two-segment name instead:

```
{page}:{component}
```

The component segment follows the same pattern as bounded components — each component declares its own `const COMPONENT` (e.g. `paragraph`, `blockquote`, `callout`). A custom Markdown link renderer intercepts all links at build time and produces anchor elements with tracking attributes already in place:

- `data-umami-event` — `{page}:{component}`
- `data-umami-event-label` — derived label from `href`
- `data-umami-event-lang` — current locale
- `data-umami-event-link-text` — visible link text (null for icon/image links)

The rule: three-segment names for components with bounded, intentional destinations (nav, hero, card, cta, footer, faq, filter, breadcrumb). Two-segment names for open-ended, editor-driven content (paragraph, blockquote, callout).

---

## Alternatives considered

**Status quo (manual event strings).** 300+ events with inconsistent casing, mixed separators, and duplicate multilingual variants. Doesn't scale.

**Single-segment label derivation.** The final path segment is frequently ambiguous. Ruled out.

**Full path as label.** Produces near-unique event names for deep pages, defeating aggregation. Ruled out.

**Selective tracking.** Track fewer events upfront. The problem is that analytics questions are often retrospective and the cost of not capturing a link is permanent. You can always filter noise out at query time, but you can never go back and reconstruct clicks that were never tracked. With a schema this clean, every link fires a well-structured event that costs you nothing to ignore and potentially a lot to have missed. Selectivity made sense when events were messy and every new one required a manual decision. When generation is automatic and the schema is consistent, we can capture everything with less noise and enhanced filtering. The schema solves the noise problem structurally: bounded components produce a finite, predictable event set; rich text collapses to `{page}:{component}` with detail in properties.

---

## Consequences

**Positive**

- Event names are generated, never typed. Casing drift and copy-paste errors are structurally impossible.
- One event per interaction regardless of language. Locale is a property, not part of the event name.
- `deriveLabel` and rich text processing run at build time.
- Additive by default — new pages need one `pathSlug` in frontmatter, new components need one `const COMPONENT`. No central registry.
- Umami wildcard queries (`fellowship:*`, `*:hero:*`, `*:*:submittable`) give clean page-, component-, and destination-level views. Path filtering in Umami isolates microsites and locales.
- Detail-page collapsing keeps the `page` dimension low-cardinality (a small enum of types) regardless of how many speakers, talks, or posts the site grows to.

**Negative**

- `TrackedLink` must be adopted across all components to realise consistency benefits.
- Rich text instrumentation requires the rehype plugin to run correctly and `pathSlug` to be present in frontmatter.
- Adding a new detail-route shape (e.g. a future `/cohort/<id>` listing) requires extending the collapsing rules. Routes not in the registry fall through to the generic last-two-segments rule and may bust the 50-char cap on long slugs — which is why the event-name builder also enforces a hard length cap as a safety net.
