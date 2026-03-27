# ADR-001: Path handling for Astro content collections

**Status:** Accepted
**Date:** 2026-03-27
**Issue:** [INTORG-543](https://linear.app/interledger/issue/INTORG-543/document-path-handling-for-astro-content-collections)

## Context

The site serves pages in English (EN) and Spanish (ES). Each page type (foundation pages, summit pages, blog posts, etc.) is modelled as an Astro content collection. We needed a convention for where MDX files live on disk so that:

1. Astro's file-based content collection IDs map predictably to URL paths.
2. EN and ES content stay co-located under the same collection without colliding.
3. The sync pipeline (MDX to Strapi) can derive a page's language and path from its file location alone, without parsing frontmatter.
4. Nested routes (e.g. `/grant/financial-services`) are represented naturally in the file system.

## Decision

All MDX files belonging to a content collection live under that collection's directory in `src/content/`. The directory structure follows these rules:

### English files

EN files sit directly inside the collection root. The file path mirrors the `pathSlug` frontmatter value.

```
src/content/<collection>/<pathSlug>.mdx
```

Examples:

```
src/content/foundation-pages/about-us.mdx          → pathSlug: 'about-us'
src/content/foundation-pages/grant/financial-services.mdx → pathSlug: 'grant/financial-services'
src/content/summit-pages/hackathon/agenda.mdx       → pathSlug: 'hackathon/agenda'
```

### Spanish files

ES files are nested under an `es/` directory immediately below the collection root. The file **name** matches the EN file it localises (the `localizes` frontmatter value), not the Spanish `pathSlug`.

```
src/content/<collection>/es/<localizes-path>.mdx
```

Examples:

```
src/content/foundation-pages/es/about-us.mdx       → localizes: 'about-us'
src/content/summit-pages/es/code-of-conduct.mdx     → localizes: 'code-of-conduct'
src/content/foundation-pages/es/grant/financial-services.mdx → localizes: 'grant/financial-services'
```

### Key rule

The EN and ES directory trees mirror each other structurally. The only difference is the `es/` prefix for Spanish files. Spanish file names follow the EN `localizes` value, not the translated slug, so that a one-to-one mapping between EN and ES files is always visible in the file system.

## Alternatives considered

### Language suffix in file name (e.g. `about-us.es.mdx`)

Astro supports this pattern natively. We rejected it because it flattens all languages into the same directory, making it harder to see at a glance which translations exist and producing noisier diffs when a collection has many pages.

### Separate collections per language (e.g. `foundation-pages-es/`)

This would keep languages fully isolated but doubles the number of collections, complicates shared schemas, and breaks the natural grouping of a page and its translation.

### Spanish file names use the translated slug

If `sobre-nosotros.mdx` localises `about-us.mdx`, using the Spanish slug as the file name makes the EN/ES mapping implicit. You would need to open the file and read `localizes` to find the pair. Using the EN name as the file name keeps the mapping visible in the file tree.

## Consequences

**Positive:**

- Language and path can be derived from the file's location without reading frontmatter, which simplifies the sync pipeline.
- `ls` or `tree` on a collection immediately shows which EN pages have ES translations.
- Nested routes map 1:1 to nested directories — no path rewriting needed.

**Negative:**

- Spanish file names don't match Spanish URLs, which can be briefly confusing for contributors unfamiliar with the convention.
- Adding a third language later means adding another language directory (e.g. `fr/`) and ensuring the mirror structure is maintained. This scales linearly but does add maintenance surface.
