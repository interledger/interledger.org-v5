# ADR-004: Locale-prefix routing for translated pages

**Status:** Proposed
**Date:** 2026-04-17
**Issue:**

## Context

The site currently serves Spanish translations at translated slugs: `/about-us` becomes `/es/sobre-nosotros`. Every Spanish URL is independently derived from the Spanish title.

This creates three compounding problems:

**Redirect maintenance.** Because Spanish URLs don't mirror their English counterparts, we maintain a bunch of additional redirects. For example when `/about-us` goes live, so does the fallback link `/es/about-us`. To prevent this link from breaking, when the Spanish aboput us translation is added in, we need a redirect from `/es/about-us` to `/es/sobre-nosotros`. Now for some large scale English content updates, layouts and content diverge from teh Spanish translation to the point where Spanish translations are removed temporarily until an updated translation comes in. At this point to prevent the `/es/sobre-nosotros` url from breaking we reverse the redirect from `/es/sobre-nosotros` to `/es/about-us` again. Once the transaltion comes back we reverse it once more from `/es/about-us` to `/es/sobre-nosotros`. This is manual, developer-gated, and error-prone.

**Language switcher complexity.** Switching between EN and ES requires a lookup from the current English slug to its Spanish equivalent (and back). This mapping must be kept in sync across Astro and Strapi. This requires the existence of the `translationMap`.

**Hreflang complexity.** `hreflang` link pairs require the full translated URL for each language variant. With translated slugs, these cannot be derived algorithmically — they require the same EN↔ES mapping that drives the language switcher, plus additional utility functions.

**Translation agency friction.** We send MDX files to the translation agency in English. In-text relative URLs (e.g. links within body copy) are currently English paths. After translation, each file must be manually reviewed and updated to swap out any English-slug links for their Spanish equivalents. This takes time and is error-prone. If we had an algorithmic update the agency could do it for us (every relatiove link starts with `/es/` instead).

The current approach also means Strapi must store and export a separate `pathSlug` per locale. This is a second place where EN/ES slug pairs must stay in sync. Updates to EN content miust reflect slug changes in ES content. It is an unnecessarily complex system.

## Decision

Move to locale-prefix routing: Spanish pages are served at `/es/<english-slug>`. The slug never changes between languages — only the locale prefix differs.

```
/about-us          → English
/es/about-us       → Spanish
```

`pathSlug` frontmatter carries the same value for both EN and ES files. The locale prefix (`/es/`) is applied at route generation time, not stored as a separate field.

### Language switcher

The switcher no longer needs a slug mapping. Given the current path, swapping locale is a prefix operation:

- EN → ES: prepend `/es/`
- ES → EN: strip `/es/`

No Strapi query, no mapping table, no risk of staleness.

### Hreflang

`hreflang` pairs are derivable from the current URL without any lookup:

```ts
const enUrl = canonicalUrl.replace(/^\/es\//, '/')
const esUrl = canonicalUrl.startsWith('/es/')
  ? canonicalUrl
  : `/es${canonicalUrl}`
```

### Redirect table

The EN-slug-to-ES-slug redirect maintenence is eliminated. We would need to have redirects for current URLs but it would not require constant updates moving forward.

### Translation agency workflow

Because Spanish URLs are structurally identical to English URLs with a `/es/` prefix, the translation agency can apply a blanket rule to all relative links in translated MDX: prefix with `/es/`. No per-link review is required.

### File structure

File naming is unchanged from ADR-001: Spanish files live under `es/` and use the EN file name, not a translated slug. This ADR aligns URL slugs with that existing convention — the file name and the URL slug now agree.

## Alternatives considered

The current set up is the alternative.

## Consequences

**Positive:**

- The redirect management is eliminated. No developer involvement is needed when a Spanish translation is added or removed.
- The `translationMap` is no longer needed.
- The language switcher becomes a string operation — no mapping, no Strapi dependency, no staleness risk.
- Hreflang pairs are derived algorithmically.
- Translation agencies can apply a blanket rule to in-text URLs; no manual link review after translation.
- `pathSlug` is a single value shared by EN and ES — one less field to keep in sync in Strapi.
- File naming (ADR-001) and URL structure now agree: both use the English slug as the canonical identifier.

**Negative:**

- Spanish URLs are not localized (e.g. `/es/about-us` instead of `/es/sobre-nosotros`). But translated slugs provide limited to no measurable SEO advantage — they do not justify the fragility, maintenance overhead, and translation friction of the current approach. This tradeoff has been reviewed and accepted by Jessica.
- A one-time migration is required: existing translated-slug URLs must be 301-redirected to their new locale-prefix equivalents. The redirect list is finite and derivable from the current EN↔ES mapping.
