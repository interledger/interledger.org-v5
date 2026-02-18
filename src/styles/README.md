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
├── theme.css                 # Dynamic utility generation (@theme inline)
├── base/                     # Base layer - CSS reset, fonts, variables
│   ├── typography.css        # Font-face declarations
│   ├── reset.css            # Tailwind Preflight + custom keyframes/elements
│   └── variables.css        # CSS custom properties + pillar overrides
└── components/              # Component layer - overridable by utilities
    ├── navigation.css       # Breadcrumb nav styles
    └── prose/              # Prose variants by content type
        ├── default.css      # Default prose (all pages)
        ├── base-typography.css  # Common h2, h3, p, lists
        ├── foundation.css   # [data-prose] specific
        ├── blog.css        # [data-prose-blog] specific
        └── summit.css      # [data-prose-summit] specific
```

## 🚨 Critical: Import Order

**DO NOT REORDER IMPORTS IN `tailwind.css`**

Tailwind v4's cascade order is: `@layer theme < base < components < utilities`

### Required Import Sequence:

1. **Base layer files first** (`base/*.css`)
   - Defines CSS variables (--color-primary, spacing, etc.)
   - Imports Tailwind Preflight reset
   - Must load before theme.css or dynamic utilities break

2. **Theme layer** (`theme.css`)
   - Generates dynamic utilities via `@theme inline`
   - Reads from CSS variables defined in base layer
   - Must load after base, before components

3. **Components layer** (`components/**/*.css`)
   - Prose styles, navigation, etc.
   - Can be overridden by utility classes
   - Must load last

### What Breaks If You Reorder:

❌ **Base after theme** → Dynamic utilities (text-primary) become undefined
❌ **Theme after components** → Utility overrides fail (component styles wrongly win)
❌ **Components before base** → CSS variables are undefined

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

1. Add color variable to `base/variables.css`:

   ```css
   --color-newpillar-main: oklch(...);
   ```

2. Add pillar override:

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

| Approach                       | Use When                               | Example                                                |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------ |
| **Config**                     | Value never changes                    | Font families, breakpoints, static border radius       |
| **@theme inline**              | Value changes by context               | Colors (pillar theming), theme-aware tokens            |
| **Config referencing CSS var** | Need both utilities + component access | Typography scale, spacing scale (used in this project) |

### Performance Impact

**Q: Do CSS variables hurt performance?**

**A: No significant impact.** Modern browsers optimize CSS variable resolution extremely well. The tiny overhead (microseconds) is negligible compared to the benefits:

- **Runtime:** CSS variables resolve at paint time (~0.001ms slower than static)
- **Bundle Size:** `var(--color)` vs `#007777` - same or smaller after gzip
- **Real-World:** No noticeable difference in typical web applications

**This Project's Approach:** CSS variables in `base/variables.css` serve as the single source of truth. The Tailwind config references these variables (`fontSize: { 'step-0': 'var(--step-0)' }`) to generate utilities, eliminating duplication and ensuring consistency.

## Prose Variant System

### Available Variants

| Variant    | Attribute           | Usage            | Key Styles                            |
| ---------- | ------------------- | ---------------- | ------------------------------------- |
| Default    | _(none)_            | All pages        | Hidden underline, reveals on hover    |
| Foundation | `data-prose`        | Foundation pages | Visible underline, hides on hover     |
| Blog       | `data-prose-blog`   | Blog articles    | Tables, code blocks, extended spacing |
| Summit     | `data-prose-summit` | Summit pages     | Heading normalization only            |

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

Tailwind v4 uses CSS `@layer` to control cascade order:

```
@layer theme      (lowest precedence)
@layer base
@layer components
@layer utilities  (highest precedence)
```

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

### Add New CSS Variable

1. Add to `:root` in `base/variables.css`
2. Use in components via `var(--your-variable)`

### Override Component Style

Use a utility class - it will always win due to layer order:

```html
<div data-prose>
  <h2 class="text-blue-500">Blue heading</h2>
</div>
```

## Troubleshooting

### Dynamic Utilities Not Working

**Symptom:** `text-primary` doesn't respond to `data-pillar` changes

**Fix:** Ensure `base/variables.css` imports before `theme.css` in `tailwind.css`

### Utility Class Not Overriding

**Symptom:** Component style wins over utility class

**Fix:** Ensure component styles are in `@layer components` block

### Pillar Theme Not Applying

**Symptom:** `data-pillar="mission"` doesn't change colors

**Fix:**

1. Check `data-pillar` attribute is on an ancestor element
2. Ensure component uses `var(--color-primary)` not hardcoded color
3. Verify pillar override exists in `base/variables.css`

### Build Fails with "Cannot resolve"

**Symptom:** Import path errors during build

**Fix:** Check file paths in `tailwind.css` are correct and files exist

## Performance Notes

- **Preflight is imported once** in `base/reset.css` - don't import elsewhere
- **CSS variables cascade** - use them instead of duplicating values
- **@theme inline** generates utilities on-demand - no bloat from unused pillar colors

## Starlight Docs Isolation

The site has **two separate CSS systems**:

### Main Site (This Architecture)

- **Pages:** Foundation, blog, summit, homepage, etc.
- **CSS:** `tailwind.css` → modular architecture (base/, components/, theme.css)
- **Variables:** `--step-*`, `--space-*`, `--color-primary` from `base/variables.css`
- **Prose:** Uses `[data-prose]`, `[data-prose-blog]`, `[data-prose-summit]`

### Starlight Docs (`/developers/docs`)

- **Pages:** Technical documentation only
- **CSS:** `interledger.css`, `atom-one-light.min.css` (configured in `astro.config.mjs`)
- **Variables:** Scoped to `.sl-container` to avoid conflicts
- **Prose:** Uses Starlight's own markdown rendering (`.sl-markdown-content`)

### Known Limitation

⚠️ **Starlight variables override main site variables within `.sl-container`**

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

**Future Fix:** Rename Starlight variables to `--sl-*` prefix (e.g., `--sl-color-primary`, `--sl-step-0`) so both sets of variables are accessible simultaneously. This requires updating `interledger.css` and all Starlight component styles.

**Current Workaround:** Keep main site components and Starlight docs completely separate. Don't nest `.sl-container` inside `[data-prose]` wrappers or vice versa.

## References

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [CSS @layer MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS Custom Properties MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
