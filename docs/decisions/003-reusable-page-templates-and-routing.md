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

Editors create a new page by choosing a template type first: FAQ, grant, profile, or custom page. The template type determines what fields are available and what the page composition looks like — not which section it belongs to.

Once a template is selected, the editor provides a required field before filling in content:

- **Path** — composed from three parts in the UI: a static `interledger.org` label, a section dropdown (`/`, `/summit`, `/hackathon`), and a free-text slug field for the remaining path. Together these produce the full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way an editor assigns a page to a section — no free-text prefix to mistype.

Strapi stores section and slug as separate fields and validates their combination via `beforeCreate`/`beforeUpdate` hooks. Astro verifies the section has a matching `LAYOUT_MAP` entry at build time — a mismatch fails the build.

### Template type as frontmatter bridge

When an editor creates a page in Strapi, `templateType`, `section`, and `locale` are written into the exported MDX frontmatter. Astro reads these to select the correct collection, layout, and rendering behaviour.

Collection entries carry four frontmatter fields that drive routing, layout selection, and filtering:

```
templateType: profile   # selects components and layout
category: fellow        # used by listing views to filter within a collection
section: foundation     # set via section dropdown; determines layout component
locale: en              # drives translation routing and listing view filtering
```

### Single catch-all route

All content is served through a single catch-all route:

```
src/pages/[...slug].astro
```

`getStaticPaths` collects all content collections and builds paths from frontmatter:

```ts
export async function getStaticPaths() {
  const allContent = [
    ...(await getCollection('profiles')),
    ...(await getCollection('faqs')),
    // add new collections here when new templates are added
  ];

  return allContent.map(entry => ({
    params: { slug: buildPagePath(entry.data.section, entry.slug) },
    props: { entry },
  }));
}
```

### Section prefix and layout maps

URL paths are assembled from a `PREFIX_MAP`:

```ts
export const PREFIX_MAP: Record<Section, string> = {
  foundation: '',
  summit: 'summit',
  hackathon: 'hackathon',
};

export function buildPagePath(section: Section, slug: string): string {
  const prefix = PREFIX_MAP[section];
  return [prefix, slug].filter(Boolean).join('/');
}
```

The correct layout component is selected at render time from a `LAYOUT_MAP`:

```ts
export const LAYOUT_MAP: Record<Section, AstroComponent> = {
  foundation: FoundationContentPage,
  summit: SummitContentPage,
  hackathon: HackathonContentPage,
};
```

```astro
---
const { entry } = Astro.props;
const Layout = LAYOUT_MAP[entry.data.section];
---
<Layout slug={entry.slug} contentLocale={entry.data.locale} />
```

If a `section` value appears in content with no matching entry in `LAYOUT_MAP`, the build fails.

Build-time validation also checks that the components used in an MDX file are compatible with its declared `templateType`, failing loudly on any mismatch.

### Listing views via frontmatter filters

Because all profiles share a single collection, listing views filter by frontmatter — no separate collections or route logic required. Locale must always be included as a filter so listing views only surface content in the correct language:

```ts
const fellows = await getCollection('profiles',
  entry => entry.data.category === 'fellow' && entry.data.locale === currentLocale
);
```

### Developer ownership surface

Developers own exactly three things:

- **New section** — add to `PREFIX_MAP`, `LAYOUT_MAP`, and create the layout component.
- **New content collection** — add to `getStaticPaths`.
- **Template composition** — define the rules for each template type, enforce them at build time, and expose the required fields in Strapi.

Everything else — URL slugs, page content — can be handled directly by editors in Strapi.

## Alternatives considered

**Section-first routing (status quo)** — routes split by section, not template. Adding a new section is a structural change and may force template logic to be duplicated per section.

**Separate collections per profile category** — a `fellows` collection, a `judges` collection, etc. Requires a developer change for every new category.

**Strapi-led template+section compatibility** — dynamic UI restrictions are not reliably achievable with Strapi's conditional field support. Validation will need to be enforced at build time instead.

## Consequences

**Positive:**

- Adding a new section is a two-line config change; no route restructuring needed.
- Editors control URL slugs, template selection, and content entirely from Strapi.
- Listing views are simple frontmatter filters — no duplication, no separate route logic.
- A missing `LAYOUT_MAP` entry is a hard build failure, not a silent runtime error.
- Translations work naturally: shared collections with locale frontmatter, path generation via `buildPagePath`.

**Negative:**

- All pages share a single route file; the routing surface is less immediately legible than file-based routes.
- `PREFIX_MAP` and `LAYOUT_MAP` must be kept in sync manually — a section added to one but not the other will break the build.
- Strapi does not validate section/template compatibility by default; mismatches are only caught at build unless `beforeCreate` and `beforeUpdate` lifecycle hooks are added to enforce path prefix rules at save time.
