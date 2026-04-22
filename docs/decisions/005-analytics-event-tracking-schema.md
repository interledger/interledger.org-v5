# ADR-005: Analytics event tracking schema

**Status:** Proposed
**Date:** 2026-04-21
**Issue:** N/A

---

## Context

Our Umami event tracking has grown inconsistent and increasingly hard to query. Problems fall into four categories.

**Manual naming drift.** Event names are entered manually, leading to inconsistencies. This causes the same interaction to be split across multiple slightly different names, making aggregation unreliable.

**Over-specific event names.** Date-stamped events like `Blog - 2026-01-07` and content-specific one-offs create effectively unique events that cannot be grouped.

**No ownership model.** There is no enforced separation between page context, UI component, and link destination. Each event is constructed ad hoc, so naming decisions are inconsistent by construction.

**Misalignment with the stack.** The site is built on reusable Astro components, MDX page files with stable `pathSlug` identifiers, and a `locales` export for i18n. The analytics layer does not reflect this structure.

Umami's UI is event-name-first: the event name is the primary filter, and event properties surface as secondary breakdown data. Page context therefore belongs in the event name — but encoding too much detail fragments events into long-tail noise. The schema must balance queryability with clean aggregation.

---

## Decision

All tracked link events follow a three-segment schema, generated from code and content identifiers — never typed by hand:

```
{page}:{component}:{label}
```

### Segments

**`page`** is the `pathSlug` defined in MDX frontmatter — a stable semantic identifier that does not change when page titles or URLs change.

**`component`** is a `const COMPONENT` declared inside each Astro component. The component declares its own identity; nothing is passed or inferred from outside.

**`label`** is derived at build time from the link's `href`.

Page and label segments must be derived by `deriveLabel()`. For internal links, the last two path segments are taken after stripping any locale prefix. For external links, the root and sub domains are used. GitHub gets special treatment to capture org and repo.

Taking two segments rather than one prevents a class of collision where the final segment alone is ambiguous. `/grants/fellowship/sheena-allen`, `/hackathon/judges/sheena-allen`, and `/summit/speakers/sheena-allen` all end in `sheena-allen` — with a single-segment rule they are indistinguishable. Two segments gives `fellowship_sheena_allen`, `judges_sheena_allen`, and `speakers_sheena_allen`.

Locale prefixes are stripped using the project's `locales` export as the source of truth. Event names should not differ based on locale. That can be filtered in Umami.

### Implementation

```typescript
// src/lib/tracking.ts
import { locales } from '../i18n/config'

export function deriveLabel(href: string): string {
  try {
    const url = new URL(href, 'https://interledger.org')
    const isInternal =
      href.startsWith('/') ||
      url.hostname === 'interledger.org' ||
      url.hostname.endsWith('.interledger.org')

    if (isInternal) {
      const parts = stripLangPrefix(
        url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
      )
      return slugify(parts.slice(-2).join('_') || 'home')
    }

    if (url.hostname === 'github.com') {
      return (
        url.pathname.split('/').filter(Boolean).slice(0, 2).join('_') ||
        'github'
      )
    }

    const hostParts = url.hostname.replace(/^www\./, '').split('.')
    return slugify(
      hostParts.length > 2 ? `${hostParts[0]}_${hostParts[1]}` : hostParts[0]
    )
  } catch {
    return slugify(href)
  }
}

const stripLangPrefix = (parts: string[]): string[] =>
  (locales as string[]).includes(parts[0]) ? parts.slice(1) : parts

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
```

### TrackedLink component

A single Astro component is the instrumentation point for all bounded link interactions across all three microsites.

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
  {/* linkText is optional — omit or pass undefined for icon-only/image links */}
>
  <slot />
</a>
```

Two properties are set on every link: `lang` from `Astro.currentLocale`, and `link_text` capturing the visible label as rendered. This makes `fellowship:hero:submittable` the same event in English and Spanish — `lang` distinguishes them in breakdown data without duplicating events.

### Rich text exception

Body content fields are editor-driven and open-ended. Encoding every inline destination into the event name produces a large, unstructured family of low-volume events that clutters the Umami event list without adding queryable value.

Rich text links use a two-segment name instead:

```
{page}:richtext
```

Label, destination URL, and link type are captured as event properties. Because this is a static build, attributes are injected at build time by processing the rendered HTML string:

```typescript
// src/components/blocks/Paragraph.astro
const processed = content.replace(/<a\s+href="([^"]+)"/g, (_, href) => {
  const isInternal = href.startsWith('/') || href.includes('interledger.org')
  const linkType = href.startsWith('#')
    ? 'anchor'
    : isInternal
      ? 'internal'
      : 'external'
  return [
    `<a href="${href}"`,
    `data-umami-event="${page}:richtext"`,
    `data-umami-event-label="${deriveLabel(href)}"`,
    `data-umami-event-href="${href}"`,
    `data-umami-event-link-type="${linkType}"`
  ].join(' ')
})
```

The rule is: use three-segment naming for components where the destination set is bounded and intentional (nav, hero, card, cta, footer, faq, filter, breadcrumb). Use two-segment naming for components where destinations are open-ended and editor-driven (richtext).

---

## Alternatives considered

**Status quo (manual event strings).** Producing 300+ events with inconsistent casing, mixed separators, and duplicate multilingual variants. Does not scale and cannot be queried reliably.

**Single-segment label derivation.** `/grants/fellowship/sheena-allen`, `/hackathon/judges/sheena-allen`, and `/summit/speakers/sheena-allen` all collapse to `sheena_allen`. Ruled out — the final segment alone is frequently ambiguous.

**Full path as label.** Produces near-unique event names for deep pages, defeating aggregation. Ruled out.

**Selective tracking (only instrument what we know we care about).** An alternative approach is to track fewer events upfront and add more instrumentation as specific questions arise. The appeal is a cleaner event list with less noise. The problem is that analytics questions are often retrospective — you can't answer "which CTA drove fellowship applications last quarter?" if you only started tracking hero clicks this month. Selective tracking also requires ongoing human judgement about what is worth instrumenting, which reintroduces the manual decision-making this schema is designed to eliminate. The schema solves the noise problem structurally: bounded components produce a finite, predictable event set, and rich text is deliberately collapsed to `{page}:richtext` with detail in properties. The result is a clean event list without sacrificing any data.

---

## Consequences

**Positive**

- Event names are generated, never typed. Casing drift, separator inconsistency, and copy-paste errors are structurally impossible.
- One event per interaction regardless of language. Locale is a property, not part of the event name.
- `deriveLabel` and rich text processing run at build time.
- Additive by default — new pages require one `pathSlug` in frontmatter, new components require one `const COMPONENT`. No central registry.
- Umami wildcard queries (`fellowship:*`, `*:hero:*`, `*:*:submittable`) give clean page-level, component-level, and destination-level views. URL path filtering in Umami isolates microsites and locales without extra instrumentation.
- Umami supports language filtering by selecting whether `/es/` is included or excluded in the path as a filter criteria.
- Umami supports microsite filtering by selecting whether `/summit/` and `/hackathon/` segments are included or excluded in the path as a filter criteria.

**Negative**

- `TrackedLink` must be adopted across all components to realise consistency benefits.
- Rich text instrumentation depends on build-time HTML processing.
- Extra build steps and potential fragility.
