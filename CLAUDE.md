# Developer Practices

## Project

- Stack: Astro, Tailwind, Strapi, TypeScript
- Mobile-first design
- Strapi is a headless data layer only. All presentation logic lives in Astro.
- Astro is the source of truth for content structure, routing, and rendering

## Astro Conventions

- Use content collections and `getStaticPaths` for any route-driven content
- Shared types live in `src/types/`, utilities in `src/utils/`, layouts in `src/layouts/`
- Prefer static output (`output: 'static'`) unless a page explicitly needs SSR

## Code Style

- Optimize for the next reader. Clarity over cleverness.
- Name things well — good names reduce the need for comments
- Keep functions small and focused. If a function can't be described in one sentence, it's doing too much.
- Logic functions over 50 lines are likely doing too much — suggest splitting. Astro component markup is exempt, but frontmatter should stay lean.
- Prefer early returns over deep nesting
- No magic numbers in logic — use named constants. Tailwind classes and markup content are fine inline.
- Extract repeated logic into well-named utilities
- Don't mix concerns (data fetching, transformation, rendering, side effects) in one function

## TypeScript

- Use strict typing everywhere
- Prefer compile-time errors over runtime errors
- Define shared interfaces in `src/types/` — don't redeclare shapes across files
- Type API responses from Strapi explicitly; don't trust `any`

## Styling

- Use Tailwind utility classes
- Prefer shared components and design tokens over one-off styles
- If a style pattern appears three or more times, extract it into a component
- Respect the existing design system before introducing new patterns

## Dependencies

- Before suggesting a new dependency, check if something already in the project solves it
- Only suggest actively maintained, widely-used packages
- Always suggest the latest stable version
- Flag if a dependency seems unnecessary.

## Error Handling & Edge Cases

- Always consider edge cases and error states
- Add error handling by default — don't leave happy-path-only code
- Handle empty states, loading states, and API failures gracefully
- Validate data at boundaries (API responses, user input, URL params)

## Errors as Values

Functions that can fail at runtime should return `T | Error` rather than throwing or returning `null`/`undefined`. Callers narrow with `x instanceof Error`.

The point: keep failure modes visible in function signatures, let the type checker complain when error cases aren't handled, and avoid the `catch + return null` pattern that hides real bugs behind "not found" branches.

For wrapping throwing third-party APIs (fetch, fs, JSON.parse), use `tryCatchAsync` from `src/utils/shared/tryCatch.ts` (mirrored to `cms/src/utils/tryCatch.ts` so each side imports through its own utils barrel). Inside our own code, return `T | Error` directly rather than wrapping.

Don't apply this to functions where there's no real failure mode. A `null` that means "not found" or "no value provided" stays `null`. The general rule from Code Style still applies: don't add error handling for cases that can't happen.

## Testing

- Write tests for utility functions and data transformations
- Test edge cases explicitly — empty arrays, null values, malformed input
- If a bug is fixed, add a test that would have caught it

## Accessibility

- Accessibility is non-negotiable
- Use semantic HTML
- Ensure keyboard navigability and visible focus states
- Add aria attributes only when semantic HTML isn't sufficient
- Consider zoom, reduced motion preferences, and screen reader behavior
- Interactive elements need accessible names and visible focus indicators

## Performance

- Watch bundle size — flag large imports
- Prefer static output
- Avoid unnecessary client-side JavaScript
- Lazy-load images and heavy components
- Optimize assets before committing
- Prefer native HTML/CSS solutions over JS when possible

## Images & the Netlify Image CDN

Image delivery has **two mutually exclusive modes**, and most image bugs come from
forgetting which one a given build is in:

- **Build-time encoder** (`scripts/optimize-images.ts`): `sharp` pre-generates
  WebP/AVIF variants into `public/img/optimized/`. Used by local `astro build`.
- **Netlify Image CDN** (`src/utils/main/imageCdn.ts`): the encoder is skipped
  and images are transformed on demand at `/.netlify/images?...`. Used on
  Netlify, and forced in CI (`pr-checks.yml` sets `IMAGE_CDN=on`).

Rules and invariants:

- **One entry point:** always resolve images through `getOptimizedImage()`
  (`src/utils/main/images.ts`). Components (`OptimizedImage.astro`,
  `ResponsiveSources.astro`, avatars, `getHeroSectionStyle`) consume its output.
  Never hand-build a `/.netlify/images` URL or an `/img/optimized/*` path.
- **The mode decision is pinned at build time.** `isImageCdnEnabled()` reads
  `IMAGE_CDN` (`on`/`off` override) else auto-detects `NETLIFY`. That result is
  frozen into the Vite `define` `__IMAGE_CDN_ENABLED__` (`astro.config.mjs`), and
  `imageCdnEnabled()` prefers the define. This is deliberate: SSR routes
  (`prerender = false`) must not re-read `process.env` per request, because
  `NETLIFY` isn't guaranteed in the Functions runtime.
- **No runtime `fs` against `public/`.** The SSR function bundle excludes
  `public/img` and `public/uploads` (INTORG-946 / ADR-008), so `getOptimizedImage`
  relies on two build-time catalogs bundled via `import.meta.glob`. Both are
  gitignored with a committed `*.stub.json` that keeps imports resolvable in
  dev/tests/non-CDN builds:
  - `src/generated/optimized-image-manifest.json` — variant catalog (build mode).
  - `src/generated/deployed-image-sources-catalog.json` — existence gate (CDN mode).
- **CDN-mode existence gating.** Because the encoder is skipped, CDN mode has no
  per-file signal, so `getOptimizedImage` gates **every** source (`/img/**` and
  `/uploads/**`) on the deployed-image-sources catalog. A source absent from this
  deploy returns the empty `OptimizedImage`, so components degrade to a plain
  `<img>` instead of a 404ing `<picture>` (browsers can't fall back from a
  404ing `<source>`, and the CMS origin is firewalled). This keeps
  `hasOptimizedVariants()` a real existence probe even in CDN mode — e.g.
  `HomepageHero` uses it to decide whether to emit the 4K hero source.
- **Uploads and the firewalled CMS.** Never reference the Strapi origin;
  absolute CMS URLs are reduced to site-relative pathnames. Uploads reach the
  repo via async git sync, so an upload rendered before the next deploy won't be
  in the catalog yet — that's the expected degrade-to-`<img>` window, not a bug.
- **One extension allowlist.** `hasOptimizableRasterExtension` in `imagePaths.ts`
  is the single source of truth for what gets optimized, shared by the encoder,
  `resolveOptimizableSource`, and the audit's `isOptimizableRasterPath`. Extend
  it there, never at a call site: the encoder's list decides what lands in the
  deployed-sources catalog and the resolver's decides what is expected in it, so
  drift makes a deliverable image look like a missing one. GIFs and SVGs are
  excluded deliberately — transcoding a GIF (or a CDN `fm=` transform) drops
  animation, and an SVG gains nothing. They ship as-is, still edge-cached by
  Netlify's CDN, just not run through the image transform.
- **Width ladders.** `DEFAULT_CDN_WIDTHS` (capped) for ordinary images;
  `TARGET_WIDTHS` (adds 2560/3840) is opt-in for genuinely 4K sources like the
  hero. Advertising 4K widths for a small image just bills extra transforms of
  clamped, byte-identical output. A source opting into `TARGET_WIDTHS` should
  also pass `intrinsicWidth` (see `withIntrinsicWidthRung`): rungs at or above
  the intrinsic width all clamp to the same pixels, and the CDN still re-encodes
  them, so for an already-AVIF/WebP source they cost bytes and a generation of
  quality rather than saving either. The helper collapses them into one rung at
  the intrinsic width, served as the file itself when the format allows.
- **CDN URLs are final.** They already contain percent-encoded query values —
  never run `encodeURI()` over them or `%2F` becomes `%252F` and the source path
  breaks.
- **Paths are literal internally, encoded only on emission.** Both catalogs are
  built from `path.relative(PUBLIC_DIR, …)`, so `hero image.avif` carries a real
  space. That literal form is what catalog lookups and `buildImageCdnUrl`
  (via `URLSearchParams`) need, so `resolveOptimizableSource` decodes the
  pathname it gets from `new URL()` to keep both entry paths in the same space.
  Any path that then becomes a URL — the `withIntrinsicWidthRung` raw rung,
  build-mode variant and `-full` paths — must go through `encodeImageUrlPath`.
  It encodes per segment rather than using `encodeURI`, because `,` and `#`
  survive `encodeURI` and a comma alone splits one srcset entry into two. Never
  apply it to a CDN URL (see the bullet above).
- **Build-time audit.** `src/integrations/audit-image-optimization.ts` scans
  `dist/**/*.html` (CDN mode only) across four carriers — `<img>`, `<picture>`,
  inline `style="background-image:url(…)"`, and `poster` — and splits findings
  by severity. It **fails the build** on `standalone-raw`,
  `picture-without-cdn`, `raw-css-background` and `raw-poster`: each means a
  component bypassed `OptimizedImage`/`getOptimizedImage`, a code defect fixable
  from the repo tree. It **logs** `degraded-marker`, where the component did
  route through `getOptimizedImage` and the designed missing-source fallback
  fired; that is deploy state, not code, so it must not abort a deploy. Escape
  hatch for a deliberate raw image: `data-allow-unoptimized` on the tag.
  Blind spots it does not claim to cover: `url()` in emitted CSS files, `<meta
og:image>`, and SSR routes (no file in `dist`) — the success message names the
  carriers checked so a clean run is not read as a whole-site guarantee.
  Catching content that references a nonexistent image is a separate job and
  wants its own check — the marker is blind to SVGs/GIFs and to anything that
  doesn't reach prerendered HTML.
- **Single-URL contexts.** A CSS background and a `poster` cannot carry a
  srcset, so they take `getOptimizedImage(src).fullSrc` and fall back to the raw
  path — see `getHeroSectionStyle` and `VideoEmbed`. Netlify clamps to the source
  width, so requesting the top rung never upscales.
- **Validation gotcha:** `astro check` is not wired up (`@astrojs/check` isn't
  installed) and will **hang on an interactive install prompt** — don't use it.
  Validate image/SSR changes with `IMAGE_CDN=on pnpm run build`, which exercises
  the CDN path and runs the audit.

## Git

- Use Conventional Commits: `type(scope): description` (e.g., `feat(blog): add search filtering to index`, `fix(api): handle empty Strapi response`)
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- Scope should match the area of the codebase affected
- One logical change per commit
- Branch naming: `type/short-description` (e.g., `feat/blog-search`, `fix/strapi-null-response`)
- Branch from `main` (or `develop` if applicable) — keep branches short-lived
- PR titles follow Conventional Commit format
- Add linear ID in Git PR so it's linked
- PR descriptions should explain _why_, not just _what_ — include context, decisions made, and anything reviewers should watch for

## Shared Utilities (`src/utils/`)

`src/utils/` is split into three lane buckets so the docs/main-site CSS isolation (see `src/styles/README.md` "Starlight Docs Isolation") stays visible at import time:

- `src/utils/shared/`: pure helpers safe on either side of the boundary. No project-internal runtime deps; no CSS-pulling chains.
- `src/utils/main/`: anything coupled to main-site routing, content collections, summit data, or i18 chains. The bulk of utilities live here.
- `src/utils/docs/`: Starlight-only helpers (RFC link rewriting, GitHub source-path parsing).

Rules:

- **Always check `src/utils/index.ts` before writing a new utility function**. It's the full catalog, grouped by lane and domain. Scan the relevant module if you need more detail.
- If a utility already exists, import it. Use the barrel `@/utils` for `shared/` and `main/` exports; use direct subpaths (`@/utils/docs/<name>`) for docs-only utilities, which are intentionally not re-exported through the barrel.
- If you add a new utility function:
  1. Pick the lane: `shared/` only if the helper is genuinely pure and useful on both sides; otherwise `main/` or `docs/`.
  2. Put it in the most semantically appropriate existing module within that lane, or create a new one if no good fit exists.
  3. For `shared/` and `main/`, add an explicit named export in `src/utils/index.ts` under the correct lane and group comment. `docs/` utilities stay out of the barrel.
- Inside `src/utils/`, cross-file imports use relative paths (`./foo` within a lane, `../<lane>/foo` across lanes). Never `@/utils/...` inside the utils folder itself.
- A `main/` utility importing from `docs/` is a smell: docs is the leaf, not a dependency. Reverse the direction or promote the helper to `shared/`.

## CMS Utilities (`cms/src/utils/`)

Same rules as `src/utils/` above, applied to the Strapi CMS layer. Import from `@/utils` (maps to `cms/src/*` via `cms/tsconfig.json`).

- **Always check `cms/src/utils/index.ts` before writing a new CMS utility** — it's the full catalog.
- If you add a new utility function:
  1. Put it in the most semantically appropriate existing module, or create a new one.
  2. Add an explicit named export in `cms/src/utils/index.ts` under the correct group comment.
- Files inside `cms/src/utils/` keep their internal cross-imports as relative paths — never import from `@/utils` inside the utils folder itself.
- `cms/src/api/utils.ts` is a thin convenience re-export for API lifecycle files — keep it delegating to `@/utils`, don't add logic to it.

## When Asked to Generate Code

- Produce clean, readable, well-named, strongly typed code by default
- Suggest splitting if a function is getting long
- Flag any tradeoffs or edge cases in the implementation
- If a new dependency is needed, explain why and confirm no existing alternative exists
- Don't solve the local problem while breaking the global structure

## When Asked to Review Code

- Check for: edge cases, accessibility, performance, error handling, naming clarity, unnecessary complexity, mixed concerns, and missing types
- Be direct. Say what's wrong and why. Suggest a fix.
- Comments should be correct, necessary, and non-obvious. Flag any that just restate the code.
