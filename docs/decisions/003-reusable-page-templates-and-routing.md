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

Additionally, two concerns must stay separate but coordinate correctly: content composition (what components make up a page, i.e. how templates are defined) and page rendering (where a page lives and how it looks, i.e. where it's placed in the file system, what layoputs it uses, what components it uses). The bridge between them must be explicit but can be handled in various ways (how we nest the content collections, how we link them to the correct layout for rendering, how best to iterate through collection-driven templates to create views).

## Decision

### Editor experience in Strapi

Editors create a new page by choosing between the page options (a profile template, a blog template, a grant template, or a custom page, etc.). Each template type is its own Strapi content type with its own field schema and MDX export lifecycle. The template type determines what fields are available and what the page composition looks like — not which section it belongs to.

All pages have a common required field:

- **Path** — composed from three parts in the UI: a static `interledger.org` label, a section dropdown (`/`, `/summit`, `/hackathon`), and a free-text slug field for the remaining path. Together these produce the full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way an editor assigns a page to a section — no free-text prefix to mistype.

### Template type as frontmatter bridge

When an editor creates a page in Strapi, `templateType`, `section`, `slug`, and `locale` are written into the exported MDX frontmatter. The Strapi lifecycle for each content type reads the `section` field to decide which collection directory to write the MDX file to (`src/content/foundation-pages/`, `src/content/summit-pages/`, or `src/content/hackathon-pages/`). Astro then reads the frontmatter to select the correct layout and rendering behaviour.

Collection entries carry four frontmatter fields that drive routing, layout selection, and filtering:

```
templateType: profile   # selects components and layout
category: fellow        # used by listing views to filter within a collection
section: foundation     # set via section dropdown; determines which collection the lifecycle writes to
locale: en              # drives translation routing and listing view filtering
```

A mismatch between the `section` field and the actual collection the file is in (e.g. a file in `summit-pages/` with `section: foundation`) is a build-time error.

### Schema shape

Each template type maps to a distinct Zod schema. These are composed into a discriminated union at the collection level, so Astro validates each entry against the correct branch at build time:

```ts
const profileSchema = z.object({
  templateType: z.literal('profile'),
  category: z.enum(['fellow', 'judge', 'speaker', 'team']),
  pathSlug: pathSlugSchema(),
  name: z.string().min(1),
  photo: z.string().nullable(),
  photoAlt: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  section: z.enum(['foundation', 'summit', 'hackathon']),
  locale: z.string().optional(),
  localizes: z.string().optional()
})

const faqPageSchema = z.object({
  templateType: z.literal('faq'),
  title: z.string().min(1),
  pathSlug: pathSlugSchema(),
  section: z.enum(['foundation', 'summit', 'hackathon']),
  locale: z.string().optional(),
  localizes: z.string().optional()
})

const customPageSchema = z.object({
  templateType: z.literal('custom')
  // ... existing foundation/summit page fields
})

export const foundationPageFrontmatterSchema = z.discriminatedUnion(
  'templateType',
  [
    profileSchema,
    faqPageSchema,
    customPageSchema
    // ...
  ]
)
```

Note: `getCollection` filter callbacks do not narrow the return type — a type guard is needed after filtering to get the correct per-template TypeScript type rather than the full union.

### Routing

Blogs can be served through `src/pages/blog/[id].astro`, grants can be served through `src/pages/grant/[...page].astro` because they are template pages with specific applications and known URL structures. But template pages that have no single location (like profiles, faqs and report pages) should simply be saved to `src/content/foundation-pages`, `src/content/summit-pages`, or `src/content/hackathon-pages` and served by the appropriate catch-all route like `src/pages/[...page].astro`, `src/pages/summit/[...page].astro`, or `src/pages/hackathon/[...page].astro`.

`getStaticPaths` in each catch-all route queries its own section collection and builds paths from the `pathSlug` and `locale` frontmatter fields. No cross-collection merging is needed.

Pages are rendered using the correct components as decided by a `switch` on `templateType` in the section renderer (e.g. `FoundationContentPage.astro`). Each branch renders a dedicated template component (`<ProfilePage />`, `<FaqPage />`, etc.) which receives the entry data as props.

Template components enforce allowed MDX components by passing only the relevant component map to `<MdxContent components={...} />`. If an MDX file uses a component not in its template's map, it fails visibly at build time rather than silently rendering nothing.

### Listing views via frontmatter filters

Because all profiles are dispersed across the foundation, hackathon and summit general page collections, listing views filter by frontmatter — no separate collections or route logic required. Locale must always be included as a filter so listing views only surface content in the correct language.

`getCollection`'s filter callback does not narrow the TypeScript type, so callers chain a type guard after filtering to get the correctly-typed entries rather than the full union:

```ts
import { isProfileEntry } from '@/utils'

const allFoundationPages = await getCollection('foundation-pages')

const fellows = allFoundationPages
  .filter(
    (entry) =>
      entry.data.templateType === 'profile' &&
      entry.data.category === 'fellow' &&
      entry.data.locale === currentLocale
  )
  .filter(isProfileEntry) // narrows CollectionEntry<'foundation-pages'> to the profile branch
```

`isProfileEntry` is a standard TypeScript type predicate: `(entry): entry is CollectionEntry<'foundation-pages'> & { data: ProfileFrontmatterType } => entry.data.templateType === 'profile'`. One guard per template type lives in `src/utils/`.

## Alternatives considered

**Separate collections per template type** (e.g. `foundation-profiles`, `summit-profiles`, `foundation-faqs`, `summit-faqs`) — each collection has a clean single schema and `getCollection` returns the right type without a type guard. Rejected because with N template types across M sections this produces N×M collections; the catch-all route must query and merge all of them, and `content.config.ts` grows with every new template type added.

**A flat file approach** — where each template type has its own collection and Astro renders them from a single catch-all entry route at `src/pages/[...page].astro`. But then we lose clean nesting where it is appropriate (like for blogs) and it will incur more technical effort to make structural changes across the code base.

**Section-first routing (status quo)** — routes split by section, not template. Adding a new section is a structural change and may force template logic to be duplicated per section.

**Separate collections per profile category** — a `fellows` collection, a `judges` collection, etc. Requires a developer change for every new category.

**Strapi-led template+section compatibility** — dynamic UI restrictions are not reliably achievable with Strapi's conditional field support. Validation will need to be enforced at build time instead.

## Migration

The existing `ambassadors` Strapi content type and `src/content/ambassadors/` collection will migrate to the generic `profile` template type with `category: fellow` and `section: foundation`. The Strapi lifecycle will be updated to write to `src/content/foundation-pages/`. The `ambassadors` collection and its dedicated route (`src/pages/grant/fellowship/[id].astro`) will be removed once migration is complete.

## Consequences

**Positive:**

- Editors control URL slugs, template selection, and content entirely from Strapi.
- Listing views are simple frontmatter filters — no duplication, no separate route logic.
- Adding a new template type means a new Strapi content type and a new Zod branch — no new collections or route files.
- The discriminated union schema enforces correct fields per template type at build time.

**Negative:**

- Templates can't be clearly delineated collections and get murky amidst the general foundation collection.
- The section-level collection contains a mix of template types; browsing `src/content/foundation-pages/` on disk doesn't immediately tell you a file's template type.
- `getCollection` filter callbacks don't narrow TypeScript types; listing views require an explicit type guard per template type.
