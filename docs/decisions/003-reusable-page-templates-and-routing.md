# ADR-003: Reusable page templates and cross-section routing

**Status:** Proposed
**Date:** 2026-04-17
**Issue:** [INTORG-560](https://linear.app/interledger/issue/INTORG-560/fellows-creata-id-pages)

## Context

The redesign moves to a template-based approach: grant pages, FAQs, and profiles each follow a fixed structure. The site also splits into three sections — Foundation, Summit, and Hackathon — after the hackathon becomes a separate microsite.

Templates must work across all three sections without duplicating template types in Strapi. Two problems make this non-trivial:

**Single-instance templates** (e.g. FAQ) must generate correct routes and layouts regardless of section. **Collection-driven templates** (e.g. profiles) must also power listing and summary views — filtering by category and locale — without duplicating content or route logic.

Additionally, two concerns must stay separate but coordinate correctly: content composition (what components make up a page, i.e. how templates are defined) and page rendering (where a page lives and how it looks, i.e. where it's placed in the file system, what layoputs it uses, what components it uses). The bridge between them must be explicit but can be handled in various ways (how we nest the content collections, how we link them to the correct layout for rendering, how best to iterate through collection-driven templates to create views).

## Decision

### Editor experience in Strapi

Editors create a new page by choosing between the page options (a profile template, a blog template, a grant template, or a custom page, etc.). The template type determines what fields are available and what the page composition looks like — not which section it belongs to.

ALl pages have a common required field:

- **Path** — composed from three parts in the UI: a static `interledger.org` label, a section dropdown (`/`, `/summit`, `/hackathon`), and a free-text slug field for the remaining path. Together these produce the full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way an editor assigns a page to a section — no free-text prefix to mistype.

### Template type as frontmatter bridge

When an editor creates a page in Strapi, `templateType`, `section`, `slug`, and `locale` are written into the exported MDX frontmatter. Astro reads these to select the correct collection, layout, and rendering behaviour.

Collection entries carry four frontmatter fields that drive routing, layout selection, and filtering:

```
templateType: profile   # selects components and layout
category: fellow        # used by listing views to filter within a collection
section: foundation     # set via section dropdown; determines layout component
locale: en              # drives translation routing and listing view filtering
```

### Routing

Blogs can be served through `src/pages/blog/[id].astro`, grants can be served through `src/pages/grant/[...page].astro` because they are template pages with specific applications and known URL structures. But template pages that have no single location (like profiles, faqs and report pages) should simply be saved to `src/content/foundation-pages` or `src/content/summit-pages` and served by the appropriate catch-all route like `src/pages/[...page].astro` or `src/pages/summit/[...page].astro`

`getStaticPaths` collects all content collections and builds paths from frontmatter:

Pages are rendered using the correct componenents as decided by the `templateType` field.

Build-time validation also checks that the components used in an MDX file are compatible with its declared `templateType`, failing loudly on any mismatch.

### Listing views via frontmatter filters

Because all profiles are disprsed acros the foundation, hackathon and summit general page collections, listing views filter by frontmatter — no separate collections or route logic required. Locale must always be included as a filter so listing views only surface content in the correct language:

```ts
const fellows = await getCollection(
  'foundation-pages',
  (entry) =>
    entry.data.templateType === 'profiles' && entry.data.category === 'fellow' && entry.data.locale === currentLocale
)
```

## Alternatives considered

**A flat file approach**  — where each template type has its own collection and Astro renderes them from a single catch-all entry route at `src/pages/[...page].astro`. But then we lose clean nesting where it is appropriate (like for blogs) and it will incur more technical effort to make structural changes acros the code base. All pages share a single route file; the routing surface is less immediately legible than file-based routes.

**Section-first routing (status quo)** — routes split by section, not template. Adding a new section is a structural change and may force template logic to be duplicated per section.

**Separate collections per profile category** — a `fellows` collection, a `judges` collection, etc. Requires a developer change for every new category.

**Strapi-led template+section compatibility** — dynamic UI restrictions are not reliably achievable with Strapi's conditional field support. Validation will need to be enforced at build time instead.

## Consequences

**Positive:**

- Editors control URL slugs, template selection, and content entirely from Strapi.
- Listing views are simple frontmatter filters — no duplication, no separate route logic.

**Negative:**

- Templates can't be clearly delineated collections and get murky amidst the general foundation collection.
