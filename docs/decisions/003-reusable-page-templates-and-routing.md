# ADR-003: Reusable page templates and cross-section routing

**Status:** Proposed
**Date:** 2026-04-17
**Issue:** [INTORG-560](https://linear.app/interledger/issue/INTORG-560/fellows-creata-id-pages)

## Context

The redesign moves to a template-based approach: grant pages, FAQs, and profiles each follow a fixed structure. The site also splits into three sections — Foundation, Summit, and Hackathon — after the hackathon becomes a separate microsite.

Templates must work across all three sections without duplicating template types in Strapi. Two problems make this non-trivial:

**Single-instance templates** (e.g. FAQ) must generate correct routes and layouts regardless of section. **Collection-driven templates** (e.g. profiles) must also power listing and summary views — filtering by category and locale — without duplicating content or route logic.

At time of writing, the known template types fall into three groups:

- **Fixed-location templates** — blog and grant pages have a predictable URL structure and a dedicated section of the site. These are served from their own route files (`src/pages/blog/`, `src/pages/grant/`).
- **Floating templates** — FAQ pages, profile pages (fellows, judges, speakers, team members), and report/research pages have no fixed home. They can appear under any section and at any path. These are the templates this ADR primarily addresses.
- **Tech templates** — the template requirements for the tech/developer section are not yet defined. This ADR assumes they will follow one of the two patterns above once scoped; the design should not foreclose either option.

Additionally, two concerns must stay separate but coordinate correctly: content composition (what components make up a page, i.e. how templates are defined) and page rendering (where a page lives and how it looks, i.e. where it's placed in the file system, what layouts it uses, what components it uses). The bridge between them must be explicit but can be handled in various ways (how we nest the content collections, how we link them to the correct layout for rendering, how best to iterate through collection-driven templates to create views).

## Decision

### Editor experience in Strapi

Editors create a new page by choosing between the page options (a profile template, a blog template, a grant template, or a custom page, etc.). Each template type is its own Strapi content type with its own field schema and MDX export lifecycle. The template type determines what fields are available and what the page composition looks like — not which section it belongs to.

All pages have a common required field:

- **Path** — composed from three parts in the UI: a static `interledger.org` label, a section dropdown (`/`, `/summit`, `/hackathon`), and a free-text slug field for the remaining path. Together these produce the full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way an editor assigns a page to a section — no free-text prefix to mistype.

### Collection structure

Floating template types each have their own content collection. The collection name identifies the template — no frontmatter field is needed for this.

```
src/content/
  profiles/         # all profile pages across all sections
  faqs/             # all FAQ pages across all sections
  reports/          # all report/research pages across all sections
  foundation-pages/ # custom pages specific to the Foundation section
  summit-pages/     # custom pages specific to the Summit section
  hackathon-pages/  # custom pages specific to the Hackathon section
```

Each collection has its own flat Zod schema matched to its template:

```ts
// src/schemas/content.ts

export const profileFrontmatterSchema = z.object({
  pathSlug: pathSlugSchema(),
  section: z.enum(['foundation', 'summit', 'hackathon']),
  category: z.enum(['fellow', 'judge', 'speaker', 'team']),
  name: z.string().min(1),
  photo: z.string().nullable(),
  photoAlt: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  locale: z.string().optional(),
  localizes: z.string().optional()
})

export const faqFrontmatterSchema = z.object({
  pathSlug: pathSlugSchema(),
  section: z.enum(['foundation', 'summit', 'hackathon']),
  title: z.string().min(1),
  locale: z.string().optional(),
  localizes: z.string().optional()
})

// foundation-pages, summit-pages, hackathon-pages keep their existing schemas
```

The `section` field is set from the section dropdown in Strapi. The Strapi lifecycle for each content type always writes MDX to its own collection directory — `profiles/` for profiles, `faqs/` for FAQs, etc. The `section` field is metadata used by catch-all routes to filter entries for their section; it does not control where the lifecycle writes.

### Routing

Fixed-location templates keep their own route files (`src/pages/blog/[id].astro`, `src/pages/grant/[...page].astro`).

Floating template pages and section-specific custom pages are served by section catch-all routes (`src/pages/[...page].astro`, `src/pages/summit/[...page].astro`, `src/pages/hackathon/[...page].astro`). Each catch-all's `getStaticPaths` queries its own section-specific custom page collection and all floating template collections filtered by `section`, then merges the results:

```ts
// src/pages/[...page].astro
export async function getStaticPaths() {
  const [customPages, profiles, faqs, reports] = await Promise.all([
    getCollection('foundation-pages'),
    getCollection('profiles', (e) => e.data.section === 'foundation'),
    getCollection('faqs', (e) => e.data.section === 'foundation'),
    getCollection('reports', (e) => e.data.section === 'foundation')
  ])

  return [...customPages, ...profiles, ...faqs, ...reports].flatMap((entry) =>
    getLocalizedPathsFromEntry(entry)
  )
}
```

A build-time check asserts that no two entries across the merged collections share the same `pathSlug` + `locale` combination, catching collisions before they produce silent routing bugs.

Pages are rendered by switching on `entry.collection` in the section renderer. Because `collection` is a literal type on `CollectionEntry`, TypeScript narrows `entry.data` correctly in each branch without a type guard:

```ts
switch (entry.collection) {
  case 'profiles':         return <ProfilePage entry={entry} />
  case 'faqs':             return <FaqPage entry={entry} />
  case 'reports':          return <ReportPage entry={entry} />
  case 'foundation-pages': return <FoundationContentPage entry={entry} />
}
```

Each template component passes only the MDX components relevant to its template to `<MdxContent components={...} />`. An MDX file that uses a component outside its template's map will fail visibly at build time.

### Listing views

Listing views query the template-type collection directly and filter by `category`, `section`, and `locale`. No type guards are needed because the collection already has a single schema:

```ts
const fellows = await getCollection(
  'profiles',
  (entry) =>
    entry.data.category === 'fellow' &&
    entry.data.section === 'foundation' &&
    entry.data.locale === currentLocale
)
// entry.data is ProfileFrontmatterType — no further narrowing needed
```

## Alternatives considered

**Section-level collections with a discriminated union schema** — all template types (profiles, FAQs, reports, custom pages) live in `foundation-pages`, `summit-pages`, and `hackathon-pages`, with a discriminant field in frontmatter selecting the schema branch per entry. Rejected because the union grows with every new template type, TypeScript inference at the collection boundary is finicky, and listing views require a type guard to recover the per-template type after filtering.

**Section-specific template collections** (e.g. `foundation-profiles`, `summit-profiles`, `foundation-faqs`, `summit-faqs`) — each combination of section and template gets its own collection. Clean schemas and no section filtering needed at query time, but produces N×M collections as template types and sections grow; `content.config.ts` and `getStaticPaths` must be updated for every new combination.

**A flat file approach** — a single catch-all route and a single collection for all pages. Loses the clean nesting that is appropriate for blogs and grants, and makes structural routing changes harder.

**Section-first routing (status quo)** — routes split by section, not template. Adding a new section is a structural change and may force template logic to be duplicated per section.

**Separate collections per profile category** — a `fellows` collection, a `judges` collection, etc. Requires a developer change for every new category.

**Strapi-led template+section compatibility** — dynamic UI restrictions are not reliably achievable with Strapi's conditional field support. Validation will need to be enforced at build time instead.

## Migration

The existing `ambassadors` Strapi content type and `src/content/ambassadors/` collection will migrate to the `profiles` collection with `category: fellow` and `section: foundation`. The Strapi lifecycle will be updated to write to `src/content/profiles/`. The `ambassadors` collection and its dedicated route (`src/pages/grant/fellowship/[id].astro`) will be removed once migration is complete.

## Consequences

**Positive:**

- Editors control URL slugs, template selection, and content entirely from Strapi.
- Each collection has a single, flat schema — no discriminated union complexity.
- `getCollection('profiles')` returns correctly-typed profiles with no type guard. Listing views are a straightforward filter.
- File organisation is semantically meaningful on disk: all profiles together, all FAQs together.
- Adding a new template type means a new Strapi content type, a new collection, and a new `case` in the renderer — no changes to existing collections or schemas.
- The renderer switches on `entry.collection`, which TypeScript narrows automatically.

**Negative:**

- Catch-all `getStaticPaths` queries multiple collections and merges them — more code than querying a single collection, though it is contained to one place per section.
- PathSlug collisions across collections (e.g. a `profiles` entry and a `foundation-pages` entry sharing the same slug for the same section) are possible and must be caught by a build-time check.
