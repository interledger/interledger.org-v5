# CSS Architecture: Prose Styling & Pillar Theming

## Problem Statement

CtaButton uses `text-(--color-btn-txt)` to set its text color, but when rendered inside MDX content, parent prose wrappers apply `[&_a]:text-primary` which overrides the button's color.

### Root Cause

Both styles land in Tailwind v4's `@layer utilities`. Within that layer:

1. **Bare utilities** (e.g. `text-(--color-btn-txt)`) are generated **first** (lower source order)
2. **Variant utilities** (e.g. `[&_:where(a)]:text-primary`) are generated **later** (higher source order)

Same specificity + later source order = parent wins. This is unfixable within `@layer utilities` alone.

### Solution

Move prose element defaults (link color, underline, heading color) into `@layer components`. Tailwind v4's implicit layer order is:

```
@layer theme < @layer base < @layer components < @layer utilities
```

Any utility class automatically beats any component-layer style — no specificity comparison needed because **layer order trumps specificity entirely**.

---

## Architecture Overview

Three systems working together:

```
@layer base     → Pillar color variables (--color-primary) set via data-pillar
@theme inline   → Bridge: generates text-accent, bg-accent utilities from --color-primary
@layer components → Prose element defaults (links, headings) reading --color-primary
@layer utilities  → Component-level overrides (CtaButton etc.) always win
```

---

## Implementation Steps

### Step 1: Add pillar color variables to `@layer base` in `src/styles/tailwind.css`

Add these pillar variables inside the existing `@layer base` block, within the `:root` selector. These values come from the Drupal v4 site (`interledger.org-v4/web/themes/interledger/css/variables.css`).

Add to the existing `:root` block in `@layer base`:

```css
/* --color-primary is the page-level theming hook (matching Drupal v4 convention).
   Components, prose rules, and base styles read this variable. Page wrappers
   override it via data-pillar to recolor an entire section.
   --color-primary is already defined in :root — no new variable needed. */

/* Pillar palette */
--color-tech-main: oklch(51.54% 0.088 194.77);
--color-tech-main-fallback: #007777;
--color-mission-main: oklch(55.27% 0.205 32.62);
--color-mission-main-fallback: #cf2801;
--color-vision-main: oklch(46.08% 0.258 291.47);
--color-vision-main-fallback: #6500d8;
--color-values-main: oklch(56.84% 0.229 3.717);
--color-values-main-fallback: #d80068;
```

Add pillar selectors AFTER the `:root` block but still inside `@layer base`:

```css
/* Pillar overrides — set on page wrapper via data-pillar attribute */
[data-pillar='tech'] {
  --color-primary: var(--color-tech-main);
}
[data-pillar='mission'] {
  --color-primary: var(--color-mission-main);
}
[data-pillar='vision'] {
  --color-primary: var(--color-vision-main);
}
[data-pillar='values'] {
  --color-primary: var(--color-values-main);
}
```

### Step 2: Add `@theme inline` block to `src/styles/tailwind.css`

Add this AFTER the `@layer base` block and BEFORE any `@layer components` block. This generates Tailwind utility classes (`text-accent`, `bg-accent`, `border-accent`, etc.) that resolve `--color-primary` at the element's DOM position:

```css
/* Bridge --color-primary to Tailwind utilities.
   @theme inline ensures var(--color-primary) is inlined in the
   generated utility CSS so it resolves at the element's DOM position,
   not at :root. This makes text-accent, bg-accent, border-accent
   respond to data-pillar overrides on ancestor elements.

   NOTE: The existing text-primary / bg-primary from tailwind.config.mjs
   are static (hardcoded oklch value). text-accent / bg-accent are dynamic
   (resolve var(--color-primary) at the element's DOM context). Use
   text-accent when you need pillar-aware color, text-primary when you
   want the default teal regardless of pillar. */
@theme inline {
  --color-accent: var(--color-primary);
}
```

### Step 3: Add `@layer components` block to `src/styles/tailwind.css`

Add this AFTER the `@theme inline` block. These are the prose element defaults that replace the inline `[&_a]:text-primary` / `[&_:where(a)]:text-primary` chains currently scattered across ~12 template files.

```css
/*
 * Prose element defaults — placed in @layer components so that
 * utility classes on child elements (e.g. CtaButton's text-(--color-btn-txt))
 * always win via Tailwind's cascade: @layer utilities > @layer components.
 *
 * Two prose contexts:
 *   [data-prose]       — light theme: accent-colored links, underlined
 *   [data-prose-blog]  — blog articles: accent-colored links, no underline
 *   [data-prose-dark]  — dark theme (summit/lander): inherit color, orange hover
 *
 * All read var(--color-primary) which defaults to --color-primary
 * but can be overridden per-page via data-pillar on a parent element.
 */
@layer components {
  /* === Shared prose typography === */
  [data-prose] h2,
  [data-prose-blog] h2 {
    margin-block-start: var(--space-l);
    margin-block-end: var(--space-s);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  [data-prose] h3,
  [data-prose-blog] h3 {
    margin-block-start: var(--space-m);
    margin-block-end: var(--space-xs);
    font-size: 1.25rem;
    font-weight: 600;
  }

  [data-prose] p,
  [data-prose-blog] p {
    margin-block-end: var(--space-s);
    line-height: 1.6;
  }

  [data-prose] ul,
  [data-prose-blog] ul,
  [data-prose] ol,
  [data-prose-blog] ol {
    margin-block-end: var(--space-s);
    padding-inline-start: var(--space-m);
  }

  [data-prose] li,
  [data-prose-blog] li {
    margin-block-end: var(--space-xs);
  }

  /* === Light theme prose links (foundation pages, paragraphs, summit) === */
  [data-prose] a {
    color: var(--color-primary);
    text-decoration-line: underline;
  }
  [data-prose] a:hover {
    text-decoration-line: none;
  }

  /* === Blog prose links (no underline by default, underline on hover) === */
  [data-prose-blog] a {
    color: var(--color-primary);
    text-decoration-line: none;
  }
  [data-prose-blog] a:hover {
    text-decoration-line: underline;
  }

  /* === Blog-specific: additional element spacing === */
  [data-prose-blog] ol {
    margin-block-end: var(--space-s);
  }
  [data-prose-blog] figure {
    margin-block-end: var(--space-s);
  }
  [data-prose-blog] hr {
    margin-block-end: var(--space-s);
  }
  [data-prose-blog] h4 {
    margin-block-end: var(--space-xs);
  }
  [data-prose-blog] figcaption {
    font-size: var(--step--1);
    font-style: italic;
  }
  [data-prose-blog] ul li {
    margin-block-end: var(--space-2xs);
  }
  [data-prose-blog] img {
    display: block;
    margin-inline: auto;
  }

  /* === Blog-specific: table styles === */
  [data-prose-blog] table {
    display: table;
    width: 100%;
    border-collapse: collapse;
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    margin-block-end: var(--space-m);
  }
  [data-prose-blog] th {
    text-align: left;
    padding-block: var(--space-3xs);
    padding-inline: var(--space-2xs);
  }
  [data-prose-blog] td {
    padding-block: var(--space-3xs);
    padding-inline: var(--space-2xs);
  }
  [data-prose-blog] thead tr {
    background-color: var(--color-table-stripe);
  }
  [data-prose-blog] thead tr:first-of-type th:first-of-type {
    border-start-start-radius: var(--border-radius);
  }
  [data-prose-blog] thead tr:first-of-type th:last-of-type {
    border-start-end-radius: var(--border-radius);
  }
  [data-prose-blog] thead + tbody tr:nth-child(2n) {
    background-color: var(--color-table-stripe);
  }
  [data-prose-blog] tbody tr:last-of-type td:first-child {
    border-end-start-radius: var(--border-radius);
  }
  [data-prose-blog] tbody tr:last-of-type td:last-child {
    border-end-end-radius: var(--border-radius);
  }

  /* === Blog-specific: inline code === */
  [data-prose-blog] :not(pre) > code {
    border-radius: var(--border-radius);
    font-size: var(--step--1);
    background-color: var(--color-bg-inline-code);
    padding-inline: 0.375rem;
    padding-block: 0.125rem;
    overflow-wrap: anywhere;
  }

  /* === Blog-specific: expressive code blocks === */
  [data-prose-blog] .expressive-code {
    margin-block-end: var(--space-s);
  }

  /* === Dark theme layout links (summit/lander) === */
  [data-prose-dark] a {
    color: currentColor;
    transition-property: color;
    transition-timing-function: var(--ease-in-out);
    transition-duration: var(--duration-slow);
    text-decoration-line: none;
  }
  [data-prose-dark] a:hover {
    color: hsla(26, 100%, 76%, 1);
  }

  /* === Dark theme layout heading normalization === */
  [data-prose-dark] h1 {
    font-size: var(--step-4);
  }
  [data-prose-dark] h2 {
    margin-block-start: 0;
    margin-block-end: 0;
    font-size: var(--step-2);
    font-weight: inherit;
    color: inherit;
  }
  [data-prose-dark] h3 {
    margin-block-start: 0;
    margin-block-end: 0;
    font-size: var(--step-1);
    font-weight: inherit;
  }
  [data-prose-dark] h4 {
    font-size: var(--step-0);
  }

  /* === Breadcrumb nav links === */
  [data-nav-links] a {
    color: var(--color-primary);
    text-decoration-line: none;
  }
}
```

### Step 4: Update template files to use `data-prose` / `data-prose-blog` / `data-nav-links`

For each file below, replace the verbose `[&_:where(a)]:...` / `[&_h2]:...` chains with the appropriate data attribute. Keep layout/spacing utilities (max-width, padding, flex, etc.) as inline Tailwind classes — only the prose element defaults move to `@layer components`.

#### 4a. `src/pages/[...page].astro`

**Current** (lines 48-54):
```astro
{/* :where(a) keeps specificity low so styled components (e.g. CtaButton)
    can override these prose defaults with their own Tailwind classes */}
<div
  class="[&_h2]:mt-space-l [&_h2]:mb-space-s [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:mt-space-m [&_h3]:mb-space-xs [&_h3]:text-[1.25rem] [&_h3]:font-semibold [&>p]:mb-space-s [&>p]:leading-[1.6] [&_ul]:mb-space-s [&_ul]:ps-space-m [&_li]:mb-space-xs [&_:where(a)]:text-primary [&_:where(a)]:underline [&_:where(a):hover]:no-underline"
>
  <Content />
</div>
```

**Replace with:**
```astro
<div data-prose>
  <Content />
</div>
```

Also add `data-pillar` to the `<main>` element. This requires extracting `pillar` from `page.data` (once the Strapi schema has the pillar field — see Step 6):

```astro
const { title, heroTitle, heroDescription, description, pillar } = page.data
```
```astro
<main class="pb-space-l" data-pillar={pillar || undefined}>
```

#### 4b. `src/pages/index.astro`

**Current** (lines 138-142):
```astro
{/* :where(a) keeps specificity low ... */}
<div class="mx-auto max-w-narrow [&_h2]:mt-space-l [&_h2]:mb-space-s [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:mt-space-m [&_h3]:mb-space-xs [&_h3]:text-[1.25rem] [&_h3]:font-semibold [&_p]:mb-space-s [&_p]:leading-[1.6] [&_ul]:mb-space-s [&_ul]:ps-space-m [&_li]:mb-space-xs [&_:where(a)]:text-primary [&_:where(a)]:underline [&_:where(a):hover]:no-underline [&_.cta-group]:my-space-m [&_.cta-group]:flex [&_.cta-group]:flex-wrap [&_.cta-group]:gap-space-s [&_.cta-group_a]:rounded-pill [&_.cta-group_a]:bg-primary [&_.cta-group_a]:px-space-s [&_.cta-group_a]:py-space-xs [&_.cta-group_a]:text-white [&_.cta-group_a]:no-underline [&_.cta-group_a:hover]:opacity-90">
    <MdxContent />
</div>
```

**Replace with:**
```astro
<div data-prose class="mx-auto max-w-narrow [&_.cta-group]:my-space-m [&_.cta-group]:flex [&_.cta-group]:flex-wrap [&_.cta-group]:gap-space-s [&_.cta-group_a]:rounded-pill [&_.cta-group_a]:bg-primary [&_.cta-group_a]:px-space-s [&_.cta-group_a]:py-space-xs [&_.cta-group_a]:text-white [&_.cta-group_a]:no-underline [&_.cta-group_a:hover]:opacity-90">
    <MdxContent />
</div>
```

NOTE: The `.cta-group` selectors remain as inline utilities because they are specific to the homepage MDX fallback, not shared prose styling.

#### 4c. `src/layouts/BlogLayout.astro`

**Current** (lines 22-28):
```astro
{/* :where(a) keeps specificity low ... */}
<article
  itemscope
  itemtype="http://schema.org/Article"
  class="mx-auto flex-1 max-w-prose min-w-[360px] max-[1324px]:px-[5%] [&_p]:mb-space-s [&_ol]:mb-space-s [&_ul]:mb-space-s [&_figure]:mb-space-s [&_hr]:mb-space-s [&_h2]:mb-space-xs [&_h3]:mb-space-xs [&_h4]:mb-space-xs [&_:where(a)]:text-primary [&_:where(a)]:no-underline [&_:where(a):hover]:underline [&_figcaption]:text-step--1 [&_figcaption]:italic [&_table]:table [&_table]:w-full [&_table]:border-collapse [&_table]:rounded [&_table]:shadow [&_table]:mb-space-m [&_th]:text-left [&_th]:py-space-3xs [&_th]:px-space-2xs [&_td]:py-space-3xs [&_td]:px-space-2xs [&_thead_tr]:bg-[var(--color-table-stripe)] [&_thead_tr:first-of-type_th:first-of-type]:rounded-ss [&_thead_tr:first-of-type_th:last-of-type]:rounded-se [&_thead+tbody_tr:nth-child(2n)]:bg-[var(--color-table-stripe)] [&_tbody_tr:first-of-type_th:first-child]:rounded-ss [&_tbody_tr:first-of-type_td:first-child]:rounded-ss [&_tbody_tr:first-of-type_th:last-child]:rounded-se [&_tbody_tr:first-of-type_td:last-child]:rounded-se [&_tbody_tr:last-of-type_th:first-child]:rounded-es [&_tbody_tr:last-of-type_td:first-child]:rounded-es [&_tbody_tr:last-of-type_th:last-child]:rounded-ee [&_tbody_tr:last-of-type_td:last-child]:rounded-ee [&_.expressive-code]:mb-space-s [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-step--1 [&_:not(pre)>code]:bg-[var(--color-bg-inline-code)] [&_:not(pre)>code]:px-[0.375rem] [&_:not(pre)>code]:py-[0.125rem] [&_:not(pre)>code]:[overflow-wrap:anywhere] [&_ul_li]:mb-space-2xs [&_img]:block [&_img]:mx-auto"
>
```

**Replace with:**
```astro
<article
  data-prose-blog
  itemscope
  itemtype="http://schema.org/Article"
  class="mx-auto flex-1 max-w-prose min-w-[360px] max-[1324px]:px-[5%]"
>
```

#### 4d. `src/components/blocks/Paragraph.astro`

**Current** (lines 27-32):
```astro
{/* :where(a) keeps specificity low ... */}
<div
  class={`mx-auto max-w-narrow ${alignmentClass} [&_p]:mb-space-s [&_p]:leading-relaxed [&_:where(a)]:text-primary [&_:where(a)]:underline [&_:where(a):hover]:no-underline [&_h2]:mt-space-l [&_h2]:mb-space-s [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:mt-space-m [&_h3]:mb-space-xs [&_h3]:text-[1.25rem] [&_h3]:font-semibold [&_ul]:mb-space-s [&_ul]:ps-space-m [&_ol]:mb-space-s [&_ol]:ps-space-m [&_li]:mb-space-xs`}
  set:html={htmlContent}
/>
```

**Replace with:**
```astro
<div
  data-prose
  class={`mx-auto max-w-narrow ${alignmentClass}`}
  set:html={htmlContent}
/>
```

#### 4e. `src/pages/summit/[...page].astro`

**Current** (line 69):
```astro
<div class="mx-auto max-w-narrow [&_h2]:mt-space-l [&_h2]:mb-space-s [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h3]:mt-space-m [&_h3]:mb-space-xs [&_h3]:text-[1.25rem] [&_h3]:font-semibold [&_p]:mb-space-s [&_p]:leading-[1.6] [&_ul]:mb-space-s [&_ul]:ps-space-m [&_li]:mb-space-xs [&_:where(a)]:underline [&_:where(a):hover]:no-underline">
```

**Replace with:**
```astro
<div data-prose class="mx-auto max-w-narrow">
```

NOTE: Summit pages use the SummitLayout which already applies link color/transition via `[&_:where(a)]` selectors on the layout wrapper div. The `data-prose` here only handles typography spacing + underline behavior. Summit link colors come from the layout level — see Step 4g.

#### 4f. `src/pages/hackathon-2023.astro`

**Current** (line 31):
```
[&_:where(a)]:no-underline
```

**Replace** the `[&_:where(a)]:no-underline` portion with keeping it as a Tailwind utility since this is a one-off nav-specific style, not prose content. No change needed — this is not prose content and doesn't need to move to `@layer components`.

#### 4g. `src/layouts/SummitLayout.astro` and `src/layouts/LanderLayout.astro`

**Current** (line 45 in both):
```astro
class="flex-1 text-step-0 [&>section]:w-full [&>section]:py-space-m [&_h1]:text-step-4 [&_h2]:text-step-2 [&_h3]:text-step-1 [&_h4]:text-step-0 [&_:where(a)]:text-current [&_:where(a)]:transition-colors [&_:where(a)]:duration-slow [&_:where(a):hover]:text-[hsla(26,100%,76%,1)]"
```

These layouts have the same `[&_:where(a)]` descendant selectors that cause the source-order problem. If a CtaButton or any styled component is rendered inside summit/lander content, its utilities would lose to these layout-level arbitrary variants. Same problem, same fix — move to `@layer components`.

**Replace with:**

```astro
data-prose-dark class="flex-1 text-step-0 [&>section]:w-full [&>section]:py-space-m"
```

The `[&>section]` selectors stay as inline utilities because they are structural layout rules (direct child only), not descendant link/heading defaults.

The link styles (text-current, transition, orange hover) and heading size normalization (h1-h4 font sizes) move to `[data-prose-dark]` rules in `@layer components`.

#### 4h. Blog pagination breadcrumbs (4 files)

Files:
- `src/pages/blog/[...page].astro`
- `src/pages/blog/es.astro`
- `src/pages/developers/blog/[...page].astro`
- `src/pages/developers/blog/es.astro`

**Current** (breadcrumb `<ol>` element):
```astro
class="flex list-none ps-0 text-step--1 font-bold pt-space-l [&_:where(a)]:text-primary [&_:where(a)]:no-underline"
```

**Replace with:**
```astro
data-nav-links class="flex list-none ps-0 text-step--1 font-bold pt-space-l"
```

### Step 5: Verify CtaButton — no changes needed

`src/components/buttons/CtaButton.astro` stays as-is. Its `text-(--color-btn-txt)` utility is in `@layer utilities` which always beats `@layer components`. The specificity issue is resolved by the layer architecture.

### Step 6: Strapi schema changes (separate PR / future work)

The Strapi CMS needs a `pillar` field on the Page content type. This is partially done in PR #16 (as `category`). The field should be renamed from `category` to `pillar` to match the established Drupal v4 taxonomy.

Files to update (in the `cms/` directory):
- `cms/src/api/page/content-types/page/schema.json` — field definition
- `cms/src/api/page/content-types/page/lifecycles.ts` — frontmatter generation
- `cms/types/generated/contentTypes.d.ts` — TypeScript types

Enum values: `'tech' | 'mission' | 'vision' | 'values'` (no `default` — absence of pillar = default primary color)

---

## How the Cascade Works After Implementation

```
Element: <a> inside a [data-prose] wrapper on a mission-pillar page

1. @layer base sets:
   [data-pillar='mission'] { --color-primary: oklch(55.27% 0.205 32.62) }

2. @layer components applies:
   [data-prose] a { color: var(--color-primary) }  → resolves to mission orange

3. But if the <a> is a CtaButton with text-(--color-btn-txt):
   @layer utilities applies:
   .text-(--color-btn-txt) { color: var(--color-btn-txt) }  → resolves to white

   Utilities layer > components layer → CtaButton wins. Problem solved.
```

---

## File Change Summary

| File | Action |
|------|--------|
| `src/styles/tailwind.css` | Add pillar variables to `@layer base`, add `@theme inline` block, add `@layer components` block |
| `src/pages/[...page].astro` | Replace prose utility chains with `data-prose`, add `data-pillar` to `<main>` |
| `src/pages/index.astro` | Replace prose utility chains with `data-prose` (keep `.cta-group` selectors) |
| `src/layouts/BlogLayout.astro` | Replace prose/table/code utility chains with `data-prose-blog` |
| `src/components/blocks/Paragraph.astro` | Replace prose utility chains with `data-prose` |
| `src/pages/summit/[...page].astro` | Replace prose utility chains with `data-prose` |
| `src/pages/blog/[...page].astro` | Replace breadcrumb link utilities with `data-nav-links` |
| `src/pages/blog/es.astro` | Replace breadcrumb link utilities with `data-nav-links` |
| `src/pages/developers/blog/[...page].astro` | Replace breadcrumb link utilities with `data-nav-links` |
| `src/pages/developers/blog/es.astro` | Replace breadcrumb link utilities with `data-nav-links` |
| `src/layouts/SummitLayout.astro` | Replace link/heading arbitrary variants with `data-prose-dark` |
| `src/layouts/LanderLayout.astro` | Replace link/heading arbitrary variants with `data-prose-dark` |
| `src/pages/hackathon-2023.astro` | No change (nav-specific one-off) |
| `src/components/buttons/CtaButton.astro` | No change (utilities layer wins automatically) |

---

## Pillar Color Reference (from Drupal v4)

| Pillar | OKLCh | Hex Fallback | Usage |
|--------|-------|-------------|-------|
| tech | `oklch(51.54% 0.088 194.77)` | `#007777` | Teal — default primary, technology content |
| mission | `oklch(55.27% 0.205 32.62)` | `#cf2801` | Orange/Red — mission content |
| vision | `oklch(46.08% 0.258 291.47)` | `#6500d8` | Purple — vision content |
| values | `oklch(56.84% 0.229 3.717)` | `#d80068` | Pink — values content |

---

## Tailwind v4 Concepts Used

- **`@layer components`**: CSS placed here is overridable by any utility class. This is the correct layer for prose defaults.
- **`@theme inline`**: Generates Tailwind utility classes (`text-accent`, `bg-accent`, etc.) that inline `var(--color-primary)` so it resolves at the element's DOM position, not at `:root`.
- **CSS custom property inheritance**: `--color-primary` set on a parent (`[data-pillar]`) cascades to all descendants. `@layer components` rules read the variable at the point of the element.
- **`@variant`**: Can be used inside `@layer components` to apply Tailwind's hover/focus implementations (e.g. `@variant hover { ... }`).

---

## Testing Checklist

After implementation, verify:

1. **CtaButton inside MDX content** — text color should be white (from `--color-btn-txt`), NOT primary teal
2. **Plain links inside [data-prose]** — should be primary teal with underline
3. **Plain links inside [data-prose-blog]** — should be primary teal, no underline, underline on hover
4. **Breadcrumb links with [data-nav-links]** — should be primary teal, no underline
5. **data-pillar="mission" on a page wrapper** — all prose links and headings should turn orange
6. **text-accent utility** — should resolve to the current pillar's accent color
7. **Summit/Lander layouts** — links should inherit text color, hover to orange (`hsla(26,100%,76%,1)`), headings should use step scale (h1=step-4, h2=step-2, etc.)
8. **hackathon-2023 sidebar** — nav link styles should be unchanged
