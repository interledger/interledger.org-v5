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
└── components/              # Component layer - overridable by utilities
    ├── navigation.css       # Breadcrumb nav styles
    └── prose/              # Prose variants by content type
        ├── default.css      # Default prose (all pages)
        ├── base-typography.css  # Common h2, h3, p, lists
        ├── foundation.css   # [data-prose] specific
        ├── blog.css        # [data-prose-blog] specific
        └── summit.css      # [data-prose-summit] specific
```

## Critical: Import Order

#### Required Import Sequence:

1. **Theme layer first** (`theme.css`)
   - Defines ALL design token VALUES in `@theme` (typography, spacing, colors, radius, shadows, animations)
   - Generates dynamic utilities via `@theme inline` (text-primary, bg-primary)
   - MUST load before base files because reset.css uses `@apply text-step-0`

2. **Base layer** (`base/*.css`)
   - typography.css: @font-face declarations
   - reset.css: extends Preflight, defines @keyframes, uses @apply (needs theme utilities)
   - variables.css: runtime vars (--color-primary base value, dependent vars, pillar overrides)

3. **Components layer** (`components/**/*.css`)
   - Prose styles, navigation, etc.
   - Can be overridden by utility classes
   - Must load last

### What Breaks If You Reorder:

**Theme after base** → `@apply text-step-0` fails (utility not yet defined)
**Components before theme** → Utility overrides fail (component styles wrongly win)
**Components before base** → Runtime CSS variables are undefined

## Pillar Theming System

### How It Works

Pages can set a `data-pillar` attribute to override the primary color theme:

```astro
<main data-pillar="mission">
  <!-- All text-primary, bg-primary, etc. use mission color -->
</main>
```

### Available Pillars

| Pillar    | Color          | Usage                     |
| --------- | -------------- | ------------------------- |
| `tech`    | Teal (default) | Technology/protocol pages |
| `mission` | Red            | Mission-related content   |
| `vision`  | Purple         | Vision-related content    |
| `values`  | Pink           | Values-related content    |

### Implementation

1. **CSS Variables** (`base/variables.css`):

   ```css
   :root {
     --color-primary: oklch(51.54% 0.088 194.77); /* Default: tech */
   }
   [data-pillar='mission'] {
     --color-primary: var(--color-mission-main);
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

1. Add color token to `theme.css` (`@theme` block):

   ```css
   --color-newpillar-main: oklch(...);
   --color-newpillar-main-fallback: #hexcolor;
   ```

2. Add pillar override to `base/variables.css`:

   ```css
   [data-pillar='newpillar'] {
     --color-primary: var(--color-newpillar-main);
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

| Approach          | Use When                                 | Example                                                                                          |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Config**        | Value never changes, no @theme namespace | Font families, breakpoints, maxWidth, gradients                                                  |
| **@theme**        | Static design tokens needing utilities   | Typography (`--text-step-0`), spacing (`--spacing-space-s`), colors, radius, shadows, animations |
| **@theme inline** | Value changes by context                 | `--color-primary` (pillar theming)                                                               |
| **variables.css** | Needs selectors or depends on other vars | `--color-primary` base, `[data-pillar]` overrides, `--color-btn-txt: var(--color-white)`         |

### This Project's Architecture

```
@theme (theme.css)          ← Single source of truth for ALL design token VALUES
  │                            Typography, spacing, colors, radius, shadows, animations
  │                            Generates utilities (text-step-0, p-space-s, bg-gray, rounded, shadow)
  │                            AND CSS variables (--text-step-0, --spacing-space-s, --color-gray, --radius, --shadow)
  │
  ▼
:root (variables.css)       ← Runtime overrides only
  --color-primary: oklch(...)     ← Base value read by @theme inline
  --color-btn-txt: var(--color-white)  ← Depends on another var
  [data-pillar='tech'] { ... }    ← Selector-scoped overrides
```

This means:

- Tailwind utilities: `class="text-step-0 p-space-s bg-gray rounded shadow"` (reads from @theme)
- Component CSS: `font-size: var(--text-step-0)` (reads @theme variable directly)
- Component CSS: `border-radius: var(--radius)` (reads @theme variable directly)
- Update token values in ONE place: `theme.css`

### @theme Namespace Reference

| Namespace     | Utility                      | Example                                                  |
| ------------- | ---------------------------- | -------------------------------------------------------- |
| `--text-*`    | `text-*` (font size)         | `--text-step-0` → `text-step-0`                          |
| `--spacing-*` | `p-*`, `m-*`, `gap-*`        | `--spacing-space-s` → `p-space-s`                        |
| `--color-*`   | `bg-*`, `text-*`, `border-*` | `--color-gray` → `bg-gray`                               |
| `--radius-*`  | `rounded-*`                  | `--radius` → `rounded`, `--radius-card` → `rounded-card` |
| `--shadow-*`  | `shadow-*`                   | `--shadow` → `shadow`, `--shadow-card` → `shadow-card`   |
| `--animate-*` | `animate-*`                  | `--animate-fade-in` → `animate-fade-in`                  |

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

### Override Component Style

Use a utility class - it will always win due to layer order:

```html
<div data-prose>
  <h2 class="text-blue-500">Blue heading</h2>
</div>
```

## Starlight Docs Isolation

The site has **two separate CSS systems**:

### Main Site (This Architecture)

- **Pages:** Foundation, blog, summit, homepage, etc.
- **CSS:** `tailwind.css` → modular architecture (base/, components/, theme.css)
- **Variables:** `--text-step-*`, `--spacing-space-*`, `--color-primary` from `theme.css` + `base/variables.css`
- **Prose:** Uses `[data-prose]`, `[data-prose-blog]`, `[data-prose-summit]`

### Starlight Docs (`/developers/docs`)

- **Pages:** Technical documentation only
- **CSS:** `interledger.css`, `atom-one-light.min.css` (configured in `astro.config.mjs`)
- **Variables:** Scoped to `.sl-container` to avoid conflicts
- **Prose:** Uses Starlight's own markdown rendering (`.sl-markdown-content`)

### Limitations

**Starlight variables override main site variables within `.sl-container`**

```css
:root {
  --color-primary: oklch(51.54%...) /* Main site */;
}

:where(.sl-container) {
  --color-primary: oklch(51.95%...) /* Starlight - overrides! */;
}
```

**Impact:** Inside Starlight pages, main site variable values are **inaccessible**.

**Why this matters:** If you want to embed a main site component (that uses `var(--color-primary)`) inside Starlight docs, it will use Starlight's color value, not the main site's.

**Future Fix:** Rename Starlight variables to `--sl-*` prefix (e.g., `--sl-color-primary`, `--sl-text-step-0`) so both sets of variables are accessible simultaneously. This requires updating `interledger.css` and all Starlight component styles.

**Current Workaround:** Keep main site components and Starlight docs completely separate. Don't nest `.sl-container` inside `[data-prose]` wrappers or vice versa.
