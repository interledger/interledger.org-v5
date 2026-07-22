# CSS Architecture Documentation

## Overview

This project uses **Tailwind CSS v4** with a modular architecture organized by layers and responsibility. The architecture implements:

- **Pillar-based theming** - Dynamic color theming via `data-pillar` attributes
- **Prose variants** - Multiple content styling contexts (foundation, blog, summit)
- **Layer-based cascade** - Explicit control over style precedence

## File Structure

```
src/styles/
├── tailwind.css              # Main entry point - imports all modules
├── theme.css                 # @theme tokens: typography, spacing, colors, radius, shadows, animations
├── base/                     # Base layer - CSS reset, fonts, runtime overrides
│   ├── typography.css        # Font-face declarations
│   ├── reset.css            # Tailwind Preflight + keyframes + element styles
│   └── variables.css        # Runtime vars: --color-primary base, dependent vars, pillar overrides
├── components/              # Component layer - overridable by utilities
│   ├── navigation.css       # Breadcrumb nav styles
│   └── prose/              # Prose variants by content type
│       ├── default.css      # Default prose (all pages)
│       ├── base-typography.css  # Common h2, h3, p, lists
│       ├── foundation.css   # [data-prose] specific
│       ├── blog.css        # [data-prose-blog] specific
│       ├── summit.css      # [data-prose-summit] specific
│       └── footnotes.css   # GFM footnotes under [data-prose] / [data-prose-blog]
└── utilities/              # Utilities layer - custom @utility definitions
    └── animations.css       # Scroll-driven animation utilities (animate-rise-in-view, etc.)
```

## Critical: Import Order

#### Required Import Sequence:

1. **Theme layer first** (`theme.css`)
   - Defines ALL design token VALUES in `@theme` (typography, spacing, colors, radius, shadows, animations)
   - Generates dynamic utilities via `@theme inline` (text-primary, bg-primary)
   - MUST load before base files because reset.css uses `@apply flex-1 text-h4 tablet:text-h4-md desktop:text-h4-lg`

2. **Base layer** (`base/*.css`)
   - typography.css: @font-face declarations
   - reset.css: extends Preflight, defines @keyframes, uses @apply (needs theme utilities)
   - variables.css: runtime vars (--color-primary base value, dependent vars, pillar overrides)

3. **Components layer** (`components/**/*.css`)
   - Prose styles, navigation, etc.
   - Can be overridden by utility classes

4. **Utilities layer** (`utilities/*.css`)
   - Custom `@utility` definitions for behaviors that can't be expressed as a `@theme` token alone (e.g. scroll-driven animations that need `animation-timeline` / `animation-range` / reduced-motion branches alongside the `animation` shorthand)
   - `@utility` rules are placed in `@layer utilities` automatically and win over component styles regardless of import order — keeping these imports last is for readability, not cascade priority

## Pillar Theming System

> **Currently orchid for every pillar, by design.** The legacy pillar accents (`--color-tech-main`, etc.) were removed in the design-token cleanup. Each `[data-pillar='X']` block in `base/variables.css` still sets `--color-primary`, but points at `--color-orchid-100` until distinct hues are chosen. Do **not** use `--color-primary: var(--color-primary)` — that self-reference is invalid at computed-value time and strips the primary color from the whole subtree (prose links, `text-primary`, etc.). See "Adding a New Pillar" below to wire a real hue.

### How It Works

Pages can set a `data-pillar` attribute to override the primary color theme:

```astro
<main data-pillar="mission">
  <!-- All text-primary, bg-primary, etc. use mission color -->
</main>
```

### Implementation

1. **CSS Variables** (`base/variables.css`):

   ```css
   :root {
     --color-primary: var(--color-orchid-100); /* Default */
   }
   [data-pillar='mission'] {
     --color-primary: var(
       --color-orchid-100
     ); /* placeholder — should map to a distinct hue */
   }
   ```

2. **Dynamic Utilities** (`theme.css`):

   ```css
   @theme inline {
     --color-primary: var(--color-primary);
   }
   ```

   This generates utilities (text-primary, bg-primary) that read from the CSS variable at the element's DOM position, not :root.

3. **Component Styles** (all `components/**/*.css`):
   ```css
   main a {
     color: var(--color-primary); /* Responds to pillar overrides */
   }
   ```

### Adding a New Pillar

1. Pick a hue family from the palette in `theme.css` (`@theme` block) to represent the pillar, e.g.:

   ```css
   --color-deep-teal-100: #09967e;
   ```

2. Add pillar override to `base/variables.css`, pointing at that hue instead of `--color-primary` itself:

   ```css
   [data-pillar='newpillar'] {
     --color-primary: var(--color-deep-teal-100);
   }
   ```

3. Add to Strapi schema and content.config.ts enum

## Design Tokens: Config vs @theme inline

### The Difference

**Tailwind Config** (`tailwind.config.mjs`) generates utilities with **static, hardcoded values**:

```js
// Config
colors: {
  primary: '#007777'
}
```

Generates:

```css
.text-primary {
  color: #007777;
} /* Always this color */
```

**@theme inline** (`theme.css`) generates utilities that **reference CSS variables** (dynamic):

```css
@theme inline {
  --color-primary: var(--color-primary);
}
```

Generates:

```css
.text-primary {
  color: var(--color-primary);
} /* Reads from variable */
```

### Why This Matters

**Static utilities** (config):

- Same value everywhere
- Cannot respond to context
- Need separate utilities per variant (text-primary-tech, text-primary-mission, etc.)

**Dynamic utilities** (@theme inline):

- Read from CSS variables at runtime
- Automatically adapt to context
- Same utility class works everywhere

**Example:**

```html
<!-- With static utilities (config) -->
<div data-pillar="mission">
  <h2 class="text-primary-mission">Must know pillar</h2>
</div>

<!-- With dynamic utilities (@theme inline) -->
<div data-pillar="mission">
  <h2 class="text-primary">Automatically orange!</h2>
</div>
```

### When to Use Each

| Approach          | Use When                                 | Example                                                                                  |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Config**        | Value never changes, no @theme namespace | Font families, breakpoints, maxWidth, gradients                                          |
| **@theme**        | Static design tokens needing utilities   | Typography (`--text-h4`), spacing (`--spacing-lg`), colors, radius, animations           |
| **@theme inline** | Value changes by context                 | `--color-primary` (pillar theming)                                                       |
| **variables.css** | Needs selectors or depends on other vars | `--color-primary` base, `[data-pillar]` overrides, `--color-btn-txt: var(--color-white)` |

### This Project's Architecture

```
@theme (theme.css)          ← Single source of truth for ALL design token VALUES
  │                            Typography, spacing, colors, radius, shadows, animations
  │                            Generates utilities (text-h4, p-lg, bg-neutral-75, rounded-lg)
  │                            AND CSS variables (--text-h4, --spacing-lg, --color-neutral-75, --radius-lg)
  │
  ▼
:root (variables.css)       ← Runtime overrides only
  --color-primary: oklch(...)     ← Base value read by @theme inline
  --color-btn-txt: var(--color-white)  ← Depends on another var
  [data-pillar='tech'] { ... }    ← Selector-scoped overrides
```

This means:

- Tailwind utilities: `class="text-h4 p-lg bg-neutral-75 rounded-lg"` (reads from @theme)
- Component CSS: `font-size: var(--text-h4)` (reads @theme variable directly)
- Component CSS: `border-radius: var(--radius-lg)` (reads @theme variable directly)
- Update token values in ONE place: `theme.css`

### @theme Namespace Reference

| Namespace     | Utility                      | Example                                                                                                         |
| ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `--text-*`    | `text-*` (font size)         | `--text-h4` → `text-h4`                                                                                         |
| `--spacing-*` | `p-*`, `m-*`, `gap-*`        | `--spacing-lg` → `p-lg`                                                                                         |
| `--color-*`   | `bg-*`, `text-*`, `border-*` | `--color-neutral-75` → `bg-neutral-75`                                                                          |
| `--radius-*`  | `rounded-*`                  | `--radius-lg` → `rounded-lg`, `--radius-full` → `rounded-full`                                                  |
| `--shadow-*`  | `shadow-*`                   | No project-specific `--shadow-*` token is currently defined — `shadow` resolves to Tailwind's built-in default. |
| `--animate-*` | `animate-*`                  | `--animate-fade-in` → `animate-fade-in`                                                                         |

See tailwind docs for more.

### Why Prose Files Use Raw CSS (Not `@apply`)

The prose CSS files (`blog.css`, `summit.css`, etc.) use raw CSS properties with
`var(--spacing-space-m)` instead of `@apply` utilities. This is intentional:

1. **CMS content is uncontrolled HTML.** Strapi renders `<table>`, `<h2>`, `<blockquote>` etc.
   We can't add Tailwind classes to those elements — selector-based styling is the only option.

2. **CSS variables ARE the design system.** `var(--spacing-space-m)` resolves to the same value
   as `p-space-m`. Using @theme variables in raw CSS is the Tailwind v4 recommended pattern
   for styling elements you don't control.

3. **Logical properties have no Tailwind equivalent.** Properties like `margin-block-end`,
   `padding-inline-start` aren't available as utilities.

4. **`@apply` is discouraged for this use case.** The Tailwind team recommends `@apply`
   sparingly, not as a wholesale replacement for CSS in component layers.

### How It Works

Prose styles are layered for flexibility:

1. **default.css** - Applies to all `<main>` elements (no attribute needed)
2. **base-typography.css** - Common h2, h3, p, lists for foundation + blog
3. **foundation.css** - Overrides link styles for `[data-prose]`
4. **blog.css** - Adds tables, code, spacing for `[data-prose-blog]`
5. **summit.css** - Normalizes headings for `[data-prose-summit]`

### Example Usage

```astro
<!-- Foundation page -->
<div data-prose>
  <h2>Heading</h2>
  <p>Paragraph with <a href="#">underlined link</a></p>
</div>

<!-- Blog article -->
<article data-prose-blog>
  <h2>Article Title</h2>
  <table>...</table>
  <code>inline code</code>
</article>

<!-- Summit page -->
<div data-prose-summit>
  <h2>Normalized heading size</h2>
</div>
```

### Adding a New Prose Variant

1. Create new file in `components/prose/`:

   ```bash
   touch src/styles/components/prose/newvariant.css
   ```

2. Add styles in `@layer components`:

   ```css
   @layer components {
     [data-prose-newvariant] h2 {
       /* Custom styles */
     }
   }
   ```

3. Import in `tailwind.css`:
   ```css
   @import './components/prose/newvariant.css';
   ```

## Layer System Explained

**Key principle:** Layer order trumps specificity.

A utility class (in utilities layer) will **always** override a component style (in components layer), regardless of specificity.

### Example

```css
/* components/prose/blog.css */
@layer components {
  [data-prose-blog] a {
    color: var(--color-primary); /* Specificity: 0,1,1 */
  }
}
```

```html
<!-- Utility ALWAYS wins due to layer order -->
<div data-prose-blog>
  <a class="text-white" href="#">White link</a>
  <!-- Link is white, not primary color -->
</div>
```

This is **why** prose styles are in `@layer components` - so developers can override them with utility classes.

## New Design System

The Figma design file is the source of truth — variable collections plus Mobile/Tablet/Desktop text styles. Update `theme.css` when the design tokens change there.

### Font

The new design system uses **Poppins** (Regular 400 / Medium 500 / SemiBold 600), self-hosted under `public/fonts/`. It's the default `body { font-family }`, so it applies everywhere unless overridden. Use the `font-poppins` Tailwind utility only when overriding a different font context (e.g. inside a component that sets its own font-family).

### Typography (responsive, breakpoint variants)

Each style has up to three tiers (Mobile → Tablet → Desktop). Apply via Tailwind's responsive prefixes; the token suffix mirrors the variant prefix:

```html
<h1 class="font-poppins text-h1 tablet:text-h1-md desktop:text-h1-lg">
  Headline
</h1>
<p class="font-poppins text-body-lg-standard tablet:text-body-lg-standard-md">
  Body
</p>
<small class="font-poppins text-caption">Caption</small>
```

Each `text-*` utility carries font-size, line-height, and font-weight together. Breakpoints follow `tablet:` (≥810px) and `desktop:` (≥1200px) from `tailwind.config.mjs`. `md:` (≥768px) and `lg:` (≥1024px) are Tailwind defaults retained for legacy code; use `tablet:` / `desktop:` for redesign work.

| Token base              | Mobile (default) | Tablet (`-md`)   | Desktop (`-lg`)    |
| ----------------------- | ---------------- | ---------------- | ------------------ |
| `text-h1`               | 56 / 68 SemiBold | 70 / 76 SemiBold | 100 / 100 SemiBold |
| `text-h2`               | 32 / 40 SemiBold | 36 / 48 SemiBold | 56 / 64 SemiBold   |
| `text-h3`               | 20 / 28 Medium   | 28 / 36 Medium   | 40 / 56 Medium     |
| `text-h4`               | 18 / 28 Regular  | 20 / 30 Regular  | 24 / 34 Regular    |
| `text-h5`               | 16 / 26 Regular  | 18 / 28 Regular  | 20 / 30 Regular    |
| `text-body-lg-emphasis` | 15 / 24 Medium   | 16 / 26 Medium   | _(same as -md)_    |
| `text-body-lg-standard` | 15 / 24 Regular  | 16 / 26 Regular  | _(same as -md)_    |
| `text-body-sm-emphasis` | 14 / 24 Medium   | _(same)_         | _(same)_           |
| `text-body-sm-standard` | 14 / 24 Regular  | _(same)_         | _(same)_           |
| `text-caption`          | 13 / 16 Regular  | _(same)_         | _(same)_           |

`body-lg-*` only ships mobile + `-md` tokens (Tablet and Desktop are identical in the spec). `body-sm-*` and `caption` are identical across all tiers, so they have a single token each.

#### Standalone line-height utilities

The line-heights baked into `text-*` utilities are also exposed as standalone `leading-*` utilities. Use them when you want to apply the heading rhythm to a non-heading element, or override the default line-height of a `text-*` utility:

```html
<p class="text-h1 leading-h2">…</p>
<!-- H1 size + weight, H2 line-height -->
<div class="leading-h3 tablet:leading-h3-md desktop:leading-h3-lg">…</div>
```

Available: `leading-h{1..5}` (with `-md` / `-lg` tiers), `leading-body-lg` + `leading-body-lg-md`, `leading-body-sm`, `leading-caption`. (`body-lg-emphasis` and `body-lg-standard` share line-heights, so there's a single `leading-body-lg`.)

### Spacing

One scale, used by every spacing utility (`p-*`, `m-*`, `gap-*`, `w-*`, `h-*`, `inset-*`, etc.):

| Token       | rem     | px  |
| ----------- | ------- | --- |
| `xs`        | 0.25rem | 4   |
| `sm`        | 0.5rem  | 8   |
| `md`        | 0.75rem | 12  |
| `lg`        | 1rem    | 16  |
| `xl`        | 1.5rem  | 24  |
| `2xl`       | 2rem    | 32  |
| `3xl`       | 3rem    | 48  |
| `3xl-tight` | 2.5rem  | 40  |
| `4xl`       | 3.75rem | 60  |
| `5xl`       | 5rem    | 80  |
| `6xl`       | 7.5rem  | 120 |
| `7xl`       | 10rem   | 160 |

**`3xl` vs `3xl-tight`** — Figma defines two values for the 3xl step: `spacing-3xl = 48px` and `padding-3xl = 40px`. Per Radu, this is intentional. Pick:

- `3xl` (48px) → default. Use for gaps, margins, and most paddings.
- `3xl-tight` (40px) → reserved for paddings that match Figma's `padding-3xl` spec specifically. Don't reach for it just because something looks crowded — `3xl` is the canonical 3xl unless Figma asks for the tighter value.

#### Token collision: do not use `max-w-{md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}` (or `min-w-*`, `w-*`, `h-*` with those keys)

Tailwind v4 derives sizing utilities (`max-w-N`, `min-w-N`, `w-N`, `h-N`) from `--spacing-N` first, falling back to `--container-N` only when no `--spacing-N` is defined. The new design system defines `--spacing-{md..7xl}`, which silently shadows Tailwind's container scale.

Concrete impact:

| Class       | Before this design system   | After this design system    |
| ----------- | --------------------------- | --------------------------- |
| `max-w-md`  | `max-width: 28rem` (448px)  | `max-width: 0.75rem` (12px) |
| `max-w-lg`  | `max-width: 32rem` (512px)  | `max-width: 1rem` (16px)    |
| `max-w-3xl` | `max-width: 48rem` (768px)  | `max-width: 3rem` (48px)    |
| `max-w-5xl` | `max-width: 64rem` (1024px) | `max-width: 5rem` (80px)    |
| `max-w-7xl` | `max-width: 80rem` (1280px) | `max-width: 10rem` (160px)  |

The class still compiles, no warning, the output just collapses to the spacing value.

**What to use instead:**

- For a content-width cap: `max-w-content` (`1440px`, defined in `tailwind.config.mjs`'s `maxWidth`). Also available: `max-w-narrow` (720px), `max-w-wide` (1600px), `max-w-prose` (960px).
- To explicitly hit Tailwind's container scale: `max-w-(--container-md)` etc. — these tokens still ship as Tailwind v4 defaults.
- For an arbitrary value: `max-w-[28rem]`.

If you grep the repo and find any `max-w-{md..7xl}` (or the `min-w-*` / `w-*` / `h-*` equivalents), assume they're broken and migrate.

### Border radius

| Token          | rem     | px  |
| -------------- | ------- | --- |
| `rounded-lg`   | 0.5rem  | 8   |
| `rounded-xl`   | 0.75rem | 12  |
| `rounded-2xl`  | 1rem    | 16  |
| `rounded-3xl`  | 1.5rem  | 24  |
| `rounded-full` | —       | 999 |

Figma's source token name is `roundend-full` (typo); corrected to `full` here.

### Colors

24 hue families × 3 shades (`50`, `100`, `150`) + 7 neutrals (`0, 25, 50, 75, 100, 150, 900`) = 79 color tokens. All available as Tailwind utilities (`bg-*`, `text-*`, `border-*`, etc.):

```html
<div class="bg-deep-teal-100 text-neutral-0">…</div>
<button class="bg-coral-red-100 hover:bg-coral-red-150">…</button>
```

Hue families: orchid, periwinkle, soft-indigo, lavender, royal-purple, ice-indigo, lagoon, deep-teal, sea-foam, aqua-mint, ocean, ice-mint, emerald, tangerine, apricot, pistachio, forest-green, cream-orange, coral-red, raspberry, flamingo, blush, wine, rose-mint.

The pillar-color semantic layer (`--color-primary`, `[data-pillar]` overrides) still uses the legacy oklch values until design picks the new-palette mapping.

### Opacity

Figma defines `opacity-50` and `opacity-100`. Tailwind already provides `opacity-50` and `opacity-100` utilities — no new utilities needed. The values are exposed as `--opacity-50: 0.5` and `--opacity-100: 1` in `:root` so designers/devs can reference them in custom CSS.

## Common Tasks

### Modify Default Link Styles

Edit `components/prose/default.css` - affects all pages.

### Modify Blog Table Styles

Edit `components/prose/blog.css` - only affects `[data-prose-blog]`.

### Change Primary Color

Edit `base/variables.css` - change `--color-primary` in `:root`.

### Add New Design Token

1. If it fits a @theme namespace (`--color-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--animate-*`): add to `theme.css`
2. If it needs selectors or depends on other vars: add to `base/variables.css`
3. Use in components via `var(--your-variable)` or as a Tailwind utility class

### Add a Custom Utility

Use `@utility` in `src/styles/utilities/` when a single `@theme` token isn't enough — e.g. an animation needing `animation-timeline`, `animation-range`, or a `prefers-reduced-motion` branch:

```css
/* src/styles/utilities/animations.css */
@utility animate-rise-in-view {
  animation: var(--animate-scroll-rise);
  animation-timeline: view();
  animation-range: 0% 30%;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
```

Import the new file from `tailwind.css` so it lands in the utilities layer.

**Don't name a `@utility` the same as an existing `--<namespace>-*` token** (e.g. `@utility animate-fade-in` alongside `--animate-fade-in`) — they collide and the `@utility` can be silently dropped. Either use a different class name (as `animate-rise-in-view` does, consuming `--animate-scroll-rise` via `var()`) or skip the token.

### Override Component Style

Use a utility class - it will always win due to layer order:

```html
<div data-prose>
  <h2 class="text-blue-500">Blue heading</h2>
</div>
```

## Starlight Docs Isolation

The site has **two separate CSS systems** that never coexist in the same browser page. Isolation is enforced by **what each page loads**, not by selector scoping.

### Main site lane

- **Pages:** foundation, blog, summit, homepage — anything using `BaseLayout.astro`.
- **CSS:** `tailwind.css`, which pulls in `theme.css`, `base/*`, `components/*`.
- **Variables:** `--text-h*`/`--text-body-*`/`--text-caption`, `--spacing-{xs..7xl}`, `--radius-{lg..3xl,full}`, `--color-primary`, etc. from `theme.css` + `base/variables.css`.
- **Prose:** `[data-prose]`, `[data-prose-blog]`, `[data-prose-summit]`.

### Docs lane

- **Pages:** Starlight-rendered pages under `/developers/`.
- **CSS:** registered in `astro.config.mjs` under Starlight's `customCss`: `@interledger/docs-design-system` themes, `interledger.css`, `atom-one-light.min.css`. Starlight bundles these into its own CSS assets and ships them only on docs routes.
- **Variables:** `--step-*`, `--space-*`, `--color-primary`, `--sl-*` from `ilf-docs.css`, `teal-theme.css`, and `interledger.css`. All at `:root` — docs pages are the only ones that load these files, so there is no caller to conflict with.
- **Prose:** Starlight's own markdown rendering (`.sl-markdown-content`).

### Rules to keep them isolated

1. **Main-site styles** go in `src/styles/theme.css`, `base/*`, `components/*`, or a new file imported by `tailwind.css`. Never imported on docs pages.
2. **Docs-only styles** go in `src/styles/interledger.css` or a new file registered under `customCss` in `astro.config.mjs`. Never imported by `tailwind.css`.
3. **Never cross-wire.** Don't `@import './interledger.css'` from `tailwind.css`. Don't add `tailwind.css` to Starlight's `customCss`. That's the only way variables can collide in the same page.
4. **Shared components** (logos, SEO head — anything rendered in both lanes) must not assume Tailwind utilities are loaded. Either:
   - Provide a plain-CSS fallback, like the SVG `fill="#000"` alongside `fill-current` in `DevelopersLogo.astro`. Tailwind wins when loaded; the SVG attribute wins when it isn't.
   - Put styles in the component's own `<style>` block (Astro scopes them per-component — safe on both sides).
5. **Don't reach across lanes for variables.** A docs component can only see variables defined in the docs lane's CSS, and vice versa. If you need the same value in both, define it in both (with matching values) — don't try to import from across.

### JS-side counterpart: `src/utils/` lane buckets

The CSS isolation above relies on docs and main-site pages not sharing JS modules. When they do (e.g. a util imported by both a Starlight component and `BaseLayout`), Rollup forms a shared chunk and writes both lanes' CSS into it. That is the mechanism behind the leak in INTORG-639 / PR #258.

To make the safe/unsafe boundary visible at import time, `src/utils/` is split into three buckets:

- `src/utils/shared/`: pure helpers safe on either side. No project-internal runtime deps; no CSS-pulling chains.
- `src/utils/main/`: anything coupled to main-site routing, content collections, summit data, or i18 chains.
- `src/utils/docs/`: Starlight-only helpers (RFC link rewrite, GitHub source-path parsing).

Import conventions:

- Main-site code uses the `@/utils` barrel for `shared/` and `main/` exports.
- Docs-side code (`src/components/docs/**`, `src/content/docs/**`) imports `shared/` directly via `@/utils/shared/<name>` and docs-only utilities via `@/utils/docs/<name>`. The barrel is intentionally a main-site surface; pulling it from docs would form the very shared chunk this split exists to prevent.

This is convention-only today. Nothing in CI enforces that a docs-side file doesn't reach into `@/utils/main/*`. INTORG-654 tracks adding a build-time or boundary-rule guardrail. Until then, the lane structure is purely for visibility and reviewer-side enforcement.

### Why not scope docs variables to `.sl-container`?

An earlier attempt wrapped `interledger.css` variables in `:where(.sl-container) { ... }`. This broke the header and sidebar: Starlight renders `<header>`, `<nav.sidebar>`, and other chrome **outside** `.sl-container`, so those elements couldn't read `--color-primary` or `--space-*` and fell back to UA defaults.

The lane split above is the actual isolation mechanism. If you ever need an extra belt-and-braces layer on top, prefix docs variables (`--ilf-docs-primary`, `--ilf-docs-step-0`) rather than fencing the shared names behind a selector that doesn't cover the whole subtree.
