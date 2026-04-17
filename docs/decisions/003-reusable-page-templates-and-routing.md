# ADR-003: Reusable page templates and cross-section routing

**Status:** Proposed
**Date:** 2026-04-17
**Issue:** [INTORG-560](https://linear.app/interledger/issue/INTORG-560/fellows-creata-id-pages)

## Context

As background knoweldge
1. As part of the redesign Jessica wants to move over to a temnplate absed approach for pages. The blogs have always been easiest for people to add because they have a set of predefine fields like title, descripotion, feature and thumbnail images, author info etc. So Jessic wants to extend this so that all grant pages folow the same format, we havea predefined FAQ page, we have one page type for all profiles (this could be team members, summit speakers, hackathon judges, fellows, etc), and so on.
2. We will have the home pages as separate (Astro-only custom pages) and we will have a custom page type (like our summit and foudnation pages now that build up based off any selection of compoennts available through the dynamic zones).
2. The redesign will be breaking the hackathon out into a separate microsite, so now we will have foundation pages, summit pages and hackathon pages. Let's refer to these as the three *sections* of the webiste

The template pages will need to work acros all sections of the webiste (foundation, summit and hackathon). The previous architecture rooted everything in a section split (summit vs. foundation), which would lead to duplicating template types on Strapi, do you want to add a foundation profile or a summit profile or a hackthon profile. This adds more options anbd clutter to the editor interface.

The core problem has two parts:

**Single-instance templates.** A single template type (e.g. "FAQ") must generate correct routes and layouts whether the content belongs to Foundation, Summit, or Hackathon. Adding a new section should not require rethinking the architecture.

**Collection-driven templates.** Some templates (e.g. profiles) must do two things: generate individual routed pages (to view details on one person) _and_ power summary/listing views (a team page view collection, or the fellows view at the bottom of the ambassadors page). These listing views need to query, filter, and group entries — fellows vs. judges, foundation vs. hackathon — without duplicating content or route logic, as efficiently and cleanly as possible.

Additionaly, two concerns must stay separate but coordinate correctly: content composition (what components make up a page, how templates are defined) and page rendering (where a page lives and how it looks, determined by the file system, layouts and components). The bridge between them must be explicit and machine-readable. I.e. a template approach can be solved through various content collection approaches on Astro, and is either made up of custom layouts, or it can simply use rules around wjhich components it can use in what order. 

## Decision

### Template type as frontmatter bridge

When an editor creates a page in Strapi, a `templateType` field is written into the exported MDX frontmatter. Astro reads this to select the correct components and layout. Strapi has no knowledge of Astro's rendering — it only records intent.

Collection entries carry three frontmatter fields that drive routing, layout selection, and filtering:

```
templateType: profile   # selects components and layout
category: fellow        # used by listing views to filter within a collection
section: foundation     # determines URL prefix and layout component
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
    // add new collections here when created
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
  hackathon: 'summit/hackathon',
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

If a `section` value appears in content with no matching entry in `LAYOUT_MAP`, the build fails loudly.

### Listing views via frontmatter filters

Because all profiles share a single collection, listing views filter by frontmatter — no separate collections or route logic required:

```ts
const fellows = await getCollection('profiles',
  entry => entry.data.category === 'fellow'
);
```

### Developer ownership surface

Developers own exactly two things:

- **New section** — add to `PREFIX_MAP`, `LAYOUT_MAP`, and create the layout component.
- **New content collection** — add to `getStaticPaths`.

Everything else — URL slugs, template composition, page content — is owned by editors in Strapi.

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
- Strapi cannot validate section/template compatibility at content-creation time; mismatches are only caught at build.
