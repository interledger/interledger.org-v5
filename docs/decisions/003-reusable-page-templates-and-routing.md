# ADR-003: Reusable page templates and cross-section routing

**Status:** Proposed
**Date:** 2026-04-17
**Issue:** [INTORG-560](https://linear.app/interledger/issue/INTORG-560/fellows-creata-id-pages)

## Context

The redesign introduces a template-based approach to page authoring. Blogs have always been the easiest content type to manage because they have a fixed set of fields — title, description, featured image, author info, etc. The goal is to extend this to other page types: grant pages follow a standard format, FAQs have a predefined structure, and all profiles (team members, summit speakers, hackathon judges, fellows, etc.) share a single type. Home pages remain bespoke Astro-only pages, and a custom page type continues to exist for freeform layouts built from dynamic zones.

The redesign also breaks the hackathon out into a separate microsite, giving the site three distinct sections: Foundation, Summit, and Hackathon.

Template pages must work across all three sections. The previous architecture rooted everything in a section split, which would require duplicating template types in Strapi — a foundation profile, a summit profile, a hackathon profile — cluttering the editor interface and making the section boundary a concern it shouldn't own.

The core problem has two parts:

**Single-instance templates.** A template type (e.g. "FAQ") must generate correct routes and layouts regardless of which section it belongs to. Adding a new section should not require rethinking the architecture.

**Collection-driven templates.** Some templates (e.g. profiles) must do two things: generate individual routed pages and power summary and listing views (a team page, or the fellows section on the ambassadors page). These listing views need to query, filter, and group entries without duplicating content or route logic.

Two concerns must stay separate but coordinate correctly: content composition (what components make up a page) and page rendering (where a page lives and how it looks). The bridge between them must be explicit — template type in frontmatter is what Astro reads to determine layout, routing, and how collection entries are iterated into listing views.

## Decision

### Editor experience in Strapi

Editors create a new page by choosing a template type first: FAQ, grant, profile, or custom page. The template type determines what fields are available and what the page composition looks like — not which section it belongs to.

Once a template is selected, the editor provides a required field before filling in content:

- **Path** — composed from three parts in the UI: a static `interledger.org` label, a section dropdown (`/`, `/summit`, `/hackathon`), and a free-text slug field for the remaining path. Together these produce the full URL, e.g. `interledger.org/summit/speakers/jane-doe`. The section dropdown is the canonical way an editor assigns a page to a section — no free-text prefix to mistype.

Both Strapi and Astro validate that the path and section stay aligned:

- **Strapi** stores the section selection and slug as separate fields, combining them into the exported path. The `beforeCreate` and `beforeUpdate` lifecycle hooks validate that the combination is well-formed before saving.
- **Astro** derives the `section` value from the stored section field at build time and verifies it has a corresponding entry in `LAYOUT_MAP`. A mismatch fails the build.

This two-layer validation ensures a summit page always uses a summit layout, and a misconfigured path cannot silently produce a page in the wrong section.

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

### Section-first routing (status quo)

The existing approach roots everything in a section split: summit pages and foundation pages live in separate route trees. This makes adding a new section (e.g. hackathon) a structural change rather than a configuration change, and forces template logic to be duplicated per section.

### Separate collections per profile category

Using a `fellows` collection, a `judges` collection, etc. mirrors the old section-first pattern at the collection level. It requires a developer change every time a new category is introduced, and makes cross-category queries (e.g. "all profiles for the hackathon") needlessly complex.

### Strapi-enforced section/template compatibility

Ideally Strapi's UI would dynamically restrict available components based on the selected template or section. This is not reliably achievable with Strapi's current conditional field support. Validation is instead enforced at build time: if template composition is incompatible with the declared section, tests catch it before import.

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
