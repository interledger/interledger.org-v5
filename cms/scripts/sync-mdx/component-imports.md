# MDX Component Registration & Reverse Sync

## Problem 1: MDX Component Registration

Astro's `<MdxContent components={{ ... }} />` requires **every JSX component used in `.mdx` files to be explicitly registered**. If a component isn't in the map, Astro throws at render time:

```
[ERROR] Expected component 'Carousel' to be defined
```

### Current state (branch `ravi/intorg-300`)

[`src/pages/[...page].astro`](../../../src/pages/[...page].astro):

```astro
<MdxContent components={{ Ambassador, AmbassadorGrid, Blockquote }} />
```

**Staging branch**: `<MdxContent />` with **no `components` prop** — any JSX block in an MDX page would fail.

### Block components that exist but are NOT yet registered

| Component | File | Strapi block type |
|---|---|---|
| `Carousel` | `src/components/blocks/Carousel.astro` | `blocks.carousel` |
| `CardsGrid` | `src/components/blocks/CardsGrid.astro` | `blocks.cards-grid` |
| `CardLinksGrid` | `src/components/blocks/CardLinksGrid.astro` | `blocks.card-links-grid` |
| `CtaBanner` | `src/components/blocks/CtaBanner.astro` | `blocks.cta-banner` |

Each requires: import in `[...page].astro` frontmatter + add to the `components={{ ... }}` prop.

---

## Problem 2: Reverse Sync — MDX Body → Strapi Page Blocks

### Current behaviour

`buildPagePayload` in [`mdxTransformer.ts`](./mdxTransformer.ts) wraps the **entire MDX body** as a single `blocks.paragraph`:

```ts
data.content = [{ __component: 'blocks.paragraph', content: mdx.content }]
```

This loses all JSX block structure. A page with:

```mdx
Some intro text.

<Carousel items={[...]} />

<CardsGrid cards={[...]} />
```

Syncs to Strapi as one paragraph blob — not as distinct `blocks.carousel` + `blocks.cards-grid` entries. Round-tripping is broken.

### Why installed libraries don't help

| Package | Purpose | Useful here? |
|---|---|---|
| `marked` | Markdown → HTML | No — can't parse JSX syntax |
| `turndown` | HTML → Markdown | No — can't parse JSX syntax |

Neither handles MDX/JSX component syntax. Need an MDX-aware parser.

---

## Approach: `remark` + `remark-mdx`

Parse MDX body to an AST, walk `mdxJsxFlowElement` nodes, extract component name + props, map to Strapi block payloads. Plain markdown segments between JSX blocks become `blocks.paragraph`.

### Deps to add to `cms/package.json`

```json
"remark": "^15.0.0",
"remark-mdx": "^3.0.0"
```

### Component → Strapi block mapping

| MDX component | Strapi `__component` | Notes |
|---|---|---|
| `<Ambassador slug="..." />` | `blocks.ambassador` | Slug lookup for relation ID |
| `<AmbassadorGrid />` | `blocks.ambassadors-grid` | No props |
| `<Blockquote>text</Blockquote>` | `blocks.blockquote` | Children as text |
| `<Carousel items={[...]} />` | `blocks.carousel` | Array prop |
| `<CardsGrid cards={[...]} />` | `blocks.cards-grid` | Array prop |
| `<CardLinksGrid cards={[...]} />` | `blocks.card-links-grid` | Array prop |
| `<CtaBanner ... />` | `blocks.cta-banner` | Props TBD |
| plain markdown text | `blocks.paragraph` | Text between JSX blocks |

---

## Test situation

### Current branch (`ravi/intorg-300`)

[`mdxTransformer.test.ts`](./mdxTransformer.test.ts) imports functions that don't exist yet:

```ts
import { getEntryField, isPageType, mdxToStrapiPayload } from './mdxTransformer'
```

`isPageType` and `mdxToStrapiPayload` are not exported from `mdxTransformer.ts` → **tests fail**.

### Branch `rs/fix-sync-mdx-tests`

Updated tests to use the existing API directly:

```ts
import { getEntryField, buildPagePayload } from './mdxTransformer'
import { foundationPageFrontmatterSchema } from './siteSchemas'
// calls: buildPagePayload(foundationPageFrontmatterSchema, mdx, null)
```

### Decision

Either:
- **A** — Implement `isPageType` + `mdxToStrapiPayload` exports in `mdxTransformer.ts` to satisfy the current tests (cleaner call-site: callers don't need to import schemas)
- **B** — Port the `rs/fix-sync-mdx-tests` test file into this branch (tests match current API)

---

## Progress Tracker

### Component registration in `src/pages/[...page].astro`

- [x] `Ambassador`
- [x] `AmbassadorGrid`
- [x] `Blockquote`
- [ ] `Carousel`
- [ ] `CardsGrid`
- [ ] `CardLinksGrid`
- [ ] `CtaBanner`

### Fix `mdxTransformer.ts` / tests

- [ ] Resolve test mismatch (Option A or B above)
- [ ] `pnpm test:sync-mdx` passes

### Reverse sync — MDX body → Strapi blocks

- [ ] Add `remark` + `remark-mdx` to `cms/package.json` devDependencies
- [ ] Create `cms/scripts/sync-mdx/mdxParser.ts` — parses MDX body, returns `Array<StrapiBlock>`
- [ ] Update `buildPagePayload` to call `mdxParser` instead of wrapping raw body in single paragraph
- [ ] Add tests for `mdxParser.ts`
- [ ] Integration: verify round-trip for a page with `Carousel`, `CardsGrid`, `Ambassador` blocks
