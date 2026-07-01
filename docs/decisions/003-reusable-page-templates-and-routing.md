# ADR-003: Reusable Page Templates and Cross-Section Routing

**Status:** Accepted
**Date:** 2026-06-29
**Issue:** [INTORG-560](https://linear.app/interledger/issue/INTORG-560/fellows-creata-id-pages)

---

## Context

The redesign moves to a template-based approach: grant pages, FAQs, and profiles each follow a fixed structure. The site splits into three sections — Foundation (the main site) and two microsites, Summit and Hackathon.

The core architectural challenge is that **template type and site section are independent concerns**. An FAQ is an FAQ whether it lives at `/faq` or `/hackathon/faq`. These two dimensions must stay independent while still producing correct URLs, layouts, and routing in Astro.

Two specific problems make this non-trivial:

**Single-instance templates** (e.g. FAQ) must generate correct routes and layouts regardless of section. **Collection-driven templates** (e.g. profiles) must also power listing and summary views — filtering by category and locale — without duplicating content or route logic.

### Template types

At time of writing, known template types fall into three groups:

**Fixed-location templates** — blog and grant pages have a predictable URL structure and a dedicated section of the site. They are served from their own route files (`src/pages/blog/`, `src/pages/grant/`) and are not addressed further by this ADR.

**Cross-section templates** — FAQ pages, profile pages (fellows, judges, speakers, team members), and report/research pages have no fixed home. They can appear under any section and at any path. These are the primary subject of this ADR.

**Tech templates** — the template requirements for the tech/developer section (e.g. `/interledger-protocol`, `/open-payments`, `/web-monetization`) are not yet fully defined, as these pages sit at flat top-level paths rather than a predictable nested structure. This ADR assumes they will follow one of the two patterns above once scoped.

This ADR addresses how content collections are structured, how they link to the correct layout, and how routing iterates over collection-driven templates to produce the correct static paths.

---

## Design Principles

Three fields capture everything needed to identify, store, and route any page:

| Concern                | Source of truth                 |
| ---------------------- | ------------------------------- |
| What is this page?     | Collection (i.e. template type) |
| Where does it belong?  | `section` field in frontmatter  |
| What URL does it have? | `section` + `pathSlug`          |

Two invariants follow from this:

> **The collection identifies what the content is. The section identifies where the content belongs.**

> **The `section` field is metadata only. It controls routing but never where content is stored.**

---

## Decision

### Editor experience in Strapi

Editors create a new page by choosing a template type (profile, FAQ, report, custom page, etc.). Each template type is its own Strapi content type with its own field schema and MDX export lifecycle. The template type determines what fields are available and what the page looks like — not which section it belongs to.

Editors never think about which Astro collection their content lands in. Storage is an implementation detail derived from the template type they selected.

All pages share one common required field:

**Path** — composed from three parts in the Strapi UI:

1. A static `interledger.org` label.
2. A section dropdown: `/` (Foundation), `/summit`, or `/hackathon`.
3. A free-text slug for the remaining path.

Together these produce a full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way to assign a page to a section — no free-text prefix to mistype, and no ambiguity about which site a page belongs to.

### Content storage

Each cross-section template type has its own Astro content collection. The collection name is the template type — no additional frontmatter discriminant is needed.

```
src/content/
  profiles/           # all profile pages across all sections
    es/               # Spanish-locale profiles
  faq/                # all FAQ pages across all sections
    es/               # Spanish-locale FAQs
  reports/            # all report/research pages across all sections
      es/             # Spanish-locale reports
  foundation-pages/   # custom pages specific to the Foundation section
  summit-pages/       # custom pages specific to the Summit section
  hackathon-pages/    # custom pages specific to the Hackathon section
```

Each collection has its own flat Zod schema matched to its template, giving correct TypeScript inference with no discriminated union complexity.

**Locale organisation within collections:** locale variants live in subdirectories of the collection directory. The default (English) locale files sit directly under the collection root (e.g. `src/content/faq/`); translated files go into a subdirectory named after the locale (e.g. `src/content/faq/es/`). A `locale` frontmatter field is required on every entry.

The Strapi lifecycle for each content type always writes MDX to its own collection directory, placing files in the correct locale subdirectory — profiles always go to `src/content/profiles/` (or `src/content/profiles/es/` for Spanish), FAQs always go to `src/content/faq/` (or `src/content/faq/es/`). The `section` field stored in frontmatter is metadata used by Astro routing; it does not affect where files are written.

### Cross-section template registry

To avoid each catch-all route manually listing every cross-section collection (and to ensure a newly added template type is not silently omitted from one section), all cross-section template types are registered in one place:

```ts
// src/lib/templates.ts

import type { CollectionKey } from 'astro:content'

export const crossSectionCollections = [
  'profiles',
  'faq',
  'reports'
] as const satisfies readonly CollectionKey[]

export type CrossSectionCollection = (typeof crossSectionCollections)[number]
```

Adding a new cross-section template type means adding one entry here. The catch-all routes, routing logic, and `getStaticPaths` all derive from this registry automatically.

### Routing

Fixed-location templates keep their dedicated route files (`src/pages/blog/[id].astro`, `src/pages/grant/[...page].astro`).

Cross-section template pages and section-specific custom pages are served by section catch-all routes:

- `src/pages/[...page].astro` — Foundation
- `src/pages/summit/[...page].astro` — Summit
- `src/pages/hackathon/[...page].astro` — Hackathon

Each catch-all's `getStaticPaths` queries its own section-specific custom page collection and all cross-section collections filtered by `section`, using the registry so no collection needs to be added manually to each route file. Filtering and path generation are both locale-aware: every entry carries a `locale` frontmatter field for that purpose.

```ts
// src/pages/[...page].astro
import { crossSectionCollections } from '@/lib/templates'

export async function getStaticPaths() {
  const crossSectionEntries = await Promise.all(
    crossSectionCollections.map((collection) =>
      getCollection(collection, (e) => e.data.section === 'foundation')
    )
  )

  const customPages = await getCollection('foundation-pages')

  return [...customPages, ...crossSectionEntries.flat()].flatMap((entry) =>
    getLocalizedPathsFromEntry(entry)
  )
}
```

A build-time check asserts that no two entries across the merged collections share the same `pathSlug` + `locale` combination, catching collisions before they produce silent routing bugs.

### Rendering

Pages are rendered by switching on `entry.collection` in the section renderer. Because `collection` is a literal type on `CollectionEntry`, TypeScript narrows `entry.data` automatically in each branch — no type guard required:

```ts
switch (entry.collection) {
  case 'profiles':         return <ProfilePage entry={entry} />
  case 'faq':              return <FaqPage entry={entry} />
  case 'reports':          return <ReportPage entry={entry} />
  case 'foundation-pages': return <FoundationContentPage entry={entry} />
}
```

Each template component passes only the MDX components relevant to its template to `<MdxContent components={...} />`. An MDX file that uses a component outside its template's allowed set will fail visibly at build time.

A separate `templateType` frontmatter field is not needed. The collection is already the discriminant for both TypeScript narrowing and renderer dispatch. Adding a separate field would duplicate information.

### Listing and summary views

Listing views query the template-type collection directly and filter by `category`, `section`, and `locale`. Because all profiles live in a single `profiles` collection, a listing never searches unrelated custom pages or FAQ entries:

```ts
const fellows = await getCollection(
  'profiles',
  (entry) =>
    entry.data.category === 'fellow' && entry.data.locale === currentLocale
)
// entry.data is ProfileFrontmatterType — no further narrowing needed
```

---

## Adding a new cross-section template type

1. Create a Strapi content type with the required field schema.
2. Create the Astro content collection and its Zod schema.
3. Add the collection name to `crossSectionCollections` in `src/lib/templates.ts`.
4. Add a `case` for it in each section renderer's switch statement.

No changes are needed to `getStaticPaths`, existing collections, or existing schemas.

---

## Alternatives Considered

**Section-level collections with a discriminated union schema** — all template types live in `foundation-pages`, `summit-pages`, and `hackathon-pages` with a discriminant field selecting the schema branch. Rejected because the union grows with every new template type, TypeScript inference at the collection boundary is unreliable, and listing views require a type guard to recover per-template types after filtering.

**Section-specific template collections** (e.g. `foundation-profiles`, `summit-profiles`) — each combination of section and template gets its own collection. Clean schemas and no section filtering at query time, but produces N×M collections as template types and sections grow. `content.config.ts` and `getStaticPaths` must be updated for every new combination.

**A single flat collection** — one catch-all route and one collection for all pages. Loses the clean per-template typing that makes listing views simple, and makes structural routing changes harder.

**Section-first routing (status quo)** — routes split by section rather than template. Adding a new section forces template logic to be duplicated across section route files.

**Separate collections per profile category** — a `fellows` collection, a `judges` collection, etc. Requires a developer change for every new category, and makes cross-category queries awkward.

**Strapi-led template-section compatibility enforcement** — dynamic UI restrictions are not reliably achievable with Strapi's conditional field support. Validation is enforced at build time instead.

---

## Migration

The existing `ambassadors` Strapi content type and `src/content/ambassadors/` collection will migrate to the `profiles` collection with `category: fellow` and `section: foundation`. The Strapi lifecycle will be updated to write to `src/content/profiles/`. The `ambassadors` collection and its dedicated route (`src/pages/grant/fellowship/[id].astro`) will be removed once migration is complete.

---

## Consequences

**Positive:**

- Editors control URL slugs, template selection, and content entirely from Strapi. Storage is invisible to them.
- Each collection has a single, flat schema — no discriminated union complexity.
- `getCollection('profiles')` returns correctly-typed profiles with no type guard. Listing views are a straightforward filter on `section`, `category`, and `locale`.
- File organisation is semantically meaningful on disk: all profiles together, all FAQs together, locale variants clearly separated by subdirectory (`faq/`, `faq/es/`).
- The cross-section template registry means adding a new template type is a localized change — one registry entry, one new collection, one new renderer `case`. No changes to existing collections, schemas, or route files.
- `entry.collection` is the single source of truth for both TypeScript narrowing and renderer dispatch. A separate `templateType` frontmatter field is unnecessary.
- Because template types are grouped by collection rather than section, listing views query only the content they need.

**Negative:**

- Each catch-all `getStaticPaths` queries multiple collections and merges them — more code than querying a single collection, though it is contained to one place per section and driven by the shared registry.
- `pathSlug` collisions across collections (e.g. a `profiles` entry and a `foundation-pages` entry sharing the same slug within the same section) are possible and must be caught by a build-time check.
