# ADR-005: Analytics event tracking schema

**Status:** Proposed
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

The `page` and `label` segments are derived via `deriveLabel()`. For internal links, the last two path segments are taken after stripping any locale prefix. For external links, root and sub domains are used. GitHub gets special treatment to capture org and repo.

Two segments instead of one prevents collisions where the final segment alone is ambiguous. `/grants/fellowship/sheena-allen`, `/hackathon/judges/sheena-allen`, and `/summit/speakers/sheena-allen` all end in `sheena-allen`. Two segments gives `fellowship_sheena_allen`, `judges_sheena_allen`, and `speakers_sheena_allen`.

Locale prefixes are stripped using the project's `locales` export. Microsite prefixes (`summit`, `hackathon`) are also stripped — both are better handled as URL path filters in Umami than encoded into every event name.

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
      const parts = stripMicrositePrefix(
        stripLangPrefix(
          url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
        )
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

const MICROSITES = ['summit', 'hackathon'] as const

const stripLangPrefix = (parts: string[]): string[] =>
  (locales as string[]).includes(parts[0]) ? parts.slice(1) : parts

const stripMicrositePrefix = (parts: string[]): string[] => {
  while (
    parts.length > 0 &&
    (MICROSITES as readonly string[]).includes(parts[0])
  )
    parts = parts.slice(1)
  return parts
}

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
```

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
{page}:richtext
```

A custom Markdown link renderer intercepts all links at build time and produces anchor elements with tracking attributes already in place:

- `data-umami-event` — `{page}:richtext`
- `data-umami-event-label` — derived label from `href`
- `data-umami-event-lang` — current locale
- `data-umami-event-link-text` — visible link text (null for icon/image links)

The rule: three-segment names for components with bounded, intentional destinations (nav, hero, card, cta, footer, faq, filter, breadcrumb). Two-segment names for open-ended, editor-driven content (richtext).

---

## Alternatives considered

**Status quo (manual event strings).** 300+ events with inconsistent casing, mixed separators, and duplicate multilingual variants. Doesn't scale.

**Single-segment label derivation.** The final path segment is frequently ambiguous. Ruled out.

**Full path as label.** Produces near-unique event names for deep pages, defeating aggregation. Ruled out.

**Selective tracking.** Track fewer events upfront. The problem is that analytics questions are often retrospective and the cost of not capturing a link is permanent. You can always filter noise out at query time, but you can never go back and reconstruct clicks that were never tracked. With a schema this clean, every link fires a well-structured event that costs you nothing to ignore and potentially a lot to have missed. Selectivity made sense when events were messy and every new one required a manual decision. When generation is automatic and the schema is consistent, we can capture everything with less noise and enhanced filtering. The schema solves the noise problem structurally: bounded components produce a finite, predictable event set; rich text collapses to `{page}:richtext` with detail in properties.

---

## Consequences

**Positive**

- Event names are generated, never typed. Casing drift and copy-paste errors are structurally impossible.
- One event per interaction regardless of language. Locale is a property, not part of the event name.
- `deriveLabel` and rich text processing run at build time.
- Additive by default — new pages need one `pathSlug` in frontmatter, new components need one `const COMPONENT`. No central registry.
- Umami wildcard queries (`fellowship:*`, `*:hero:*`, `*:*:submittable`) give clean page-, component-, and destination-level views. Path filtering in Umami isolates microsites and locales.

**Negative**

- `TrackedLink` must be adopted across all components to realise consistency benefits.
- Rich text instrumentation requires the rehype plugin to run correctly and `pathSlug` to be present in frontmatter.
