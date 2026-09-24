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
- Redirects: literal paths go in `redirects.ts`; any rule with a `[param]` goes in `public/_redirects`, written in Netlify syntax (`:param`, `*` in the source, `:splat` in the destination). The Netlify adapter emits a dynamic `[...rest]` destination as a literal `*`, so the redirect lands on a 404, and it appends its rules after `public/_redirects`, where they can't be ordered. `src/redirects.test.ts` enforces this.

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

### Two suites: `src` and `cms`

There are exactly two suites, and they are named after the folders they cover — never call either one "root":

| Suite | Config                 | Run from  | CI job     |
| ----- | ---------------------- | --------- | ---------- |
| `src` | `vitest.config.ts`     | repo root | `Test src` |
| `cms` | `cms/vitest.config.ts` | `cms/`    | `Test cms` |

`pnpm test` runs a suite; `pnpm test:coverage` runs it with coverage. They are separate CI jobs so they fail and report independently.

### Coverage

Both suites use the `v8` provider with an explicit `coverage.include`. That is deliberate: vitest otherwise reports only files a test imported, which hides untested modules and inflates the percentage. **Adding a new untested file lowers coverage** — that is the intended behaviour, not a misconfiguration.

`coverage.thresholds` gates both suites, with all four metrics set (`statements`, `branches`, `functions`, `lines`). Set all four, not just one — a file with no conditionals reports 100% branches with zero tests, so a branches-only gate enforces nothing.

Metrics are not interchangeable: `statements`/`lines` are the headline, `functions` shows what is never called at all, `branches` shows how well already-tested code is exercised. Treat a high branch score on a low-statement file as meaningless.

**Bumping thresholds.** When measured coverage for a metric is **more than 5 points above its configured threshold**, recommend raising that threshold. Leave 1–2 points of headroom below the new measurement rather than pinning it exactly — a threshold set to the current value fails the next PR that adds a file, which trains people to bypass the gate.

- Raise floors with `pnpm test:coverage --coverage.thresholds.autoUpdate`, which rewrites the config in place. **Local only** — in CI it produces a config diff nothing can commit, so the ratchet silently does nothing.
- Glob thresholds (e.g. `'src/utils/shared/**'`) are an _additional_ check, not a carve-out from the global one. Use them to lock in areas that are already well covered.
- A glob matching no files passes silently. After adding one, confirm it fires by temporarily setting it above the current value and checking the error names the glob.

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

## Internal Link Validation

`src/integrations/validate-internal-links.ts` scans `dist/**/*.html` in
`astro:build:done` and reports internal links and fragments that this deploy
does not serve — warning by default, failing the build under
`LINK_CHECK=strict` (see below). It replaced `starlight-links-validator`, which
only ever covered the 13 Starlight `docs` pages — 0.6% of the site, and none of
the places real breakage lives.

- **Never resolve a target against a route's `patternRegex`.** `[...page].astro`
  compiles to `^(?:\/(.*?))?\/?$`, and in a JS regex `.` matches `/`, so it
  matches every path on the site. 26 of the dynamic routes are catch-alls like
  this — use one and the check passes every broken link forever, silently.
  `astro:routes:resolved` is read for exactly two things: literal SSR route
  patterns and literal redirect sources. Prerendered routes are covered by the
  files they emitted, which is an exact set.
- **Valid targets** = dist files ∪ dist index directories ∪ `redirects.ts`
  sources ∪ SSR routes ∪ the rules in `dist/_redirects`, then `netlify.toml`
  (Netlify's order; the toml rules never reach `dist/_redirects`), plus two
  small allowlists: `/robots.txt` and `/_redirects` exactly, and anything under
  `/.netlify/` or `/.well-known/`. Files are checked before rules, as on
  Netlify, and a 404 rule never counts as a resolution — `/404.html` is a real
  file, so following it would pass the link.
- **Register it last** in `astro.config.mjs`. Hooks run in array order and it
  reads files other integrations write in their own `astro:build:done` — the
  sitemap XML in particular.
- **HTML-entity-decode before splitting on `#` or `?`.** `&#38;` contains a
  literal `#`, and every `/.netlify/images` URL separates params with it.
- **Never scan `data-*`.** Over two million values, and
  `data-umami-event-link-text` holds free prose that parses as phantom schemes
  and fragments. Carriers are `href`, `src`, `srcset`, `action`, `poster`.
- **Protocol-relative `//host/path` is external**, not the internal path
  `/host/path`. Test it before the leading-slash check.
- **Self-origin absolute URLs are internal** and must be validated: `hreflang`,
  canonical are both emitted that way, and that is where a whole class of
  breakage hid.
- **Relative links resolve against the served URL.** `about-us/index.html` is
  served at `/about-us/`, and against the slashless form `new URL` drops a
  segment. `fromPathname` must stay slashless — a bare `#frag` returns it as the
  dist-index key — so `classifyHref` takes `servedWithTrailingSlash` separately.
- **Findings warn; only Force Reset fails.** Editors commit MDX straight to
  `staging` with no PR and fix most of their own broken links quickly, so
  failing every build would stop staging far more often than it would prevent
  anything reaching production — and a PR to `staging` is built merged with
  `staging`, so it would block developers on someone else's pending typo.
  `LINK_CHECK=strict` turns findings into a build failure, and only a production
  publish via `reset.yml` sets it. That gate runs **before** the force-push, so a finding
  leaves the branch untouched: Netlify is never triggered and the live site is
  unchanged rather than rolled back. Broken links therefore accumulate on
  staging as warnings and must be cleared before the next publish.
- **A rollback can outrun the check.** `verify` builds the target SHA's own
  tree, so `LINK_CHECK=strict` is inert on any commit predating the integration.
  That stays a warning, not a failure — a rollback target already ran, and
  blocking an incident rollback over its pre-existing link rot inverts the
  priority. `reset.yml` guarantees only that the skip is loud: it reports up
  front whether the SHA carries the check. Running the current validator against
  an old tree is not an option — `redirects.ts` reaches the check only through
  `astro:routes:resolved`, and the `prerender = false` routes appear nowhere in
  `dist`, so any out-of-build runner reports all ~460 redirect sources and every
  SSR route as broken. The workflow file itself always comes from the dispatch
  ref, never from the SHA being published, so a rollback never degrades the next
  run.
- **Redirect destinations are checked, and fail like any other broken link.**
  Read `route.redirect`, never `route.redirectRoute` — Astro matches the latter
  against lowercased, slashless keys, so it is `undefined` for a destination
  written with a slash. Exempt by **source**: the destination is a link target,
  so listing it would also hide direct links to that path.
- **`INTERNAL_LINK_EXCEPTIONS`** is a flat list of targets (exact match, no
  globs; each entry carries a comment saying why). An entry that stops being
  needed — its target resolves now, or nothing links to it any more — is
  reported as a warning, never a failure.
- **Blind spots**, neither checked nor reported — a clean run is not a
  whole-site guarantee: `url()` in emitted CSS, `og:image` and `og:url`
  (`<meta content>` isn't scanned; `og:url` shares canonical's value, so it is
  covered indirectly), JS-generated anchors, external URLs, and anything only
  an SSR route renders.
- **`hreflang` is opt-out.** `buildCanonicalMeta` maps a slug across locales
  without knowing which pages were built, so pages whose twin may not exist pass
  `localeAlternates={false}` (see `BaseLayout`). Paginated listings past page 1
  opt out on both counts: ES carries fewer posts, and page 4 of the EN blog is
  not the translation of page 4 of the ES blog anyway.

## The Publish Gate (future-dated blog posts)

Site changes are promoted from `staging` to production on a cadence, so a blog
post scheduled for a future launch date must not block unrelated promotions. On
production the `date` frontmatter field is a real publish gate: a post dated
later than today is excluded from the collection entirely. Staging, playground,
deploy previews and local dev show everything, so upcoming content stays
reviewable.

- **One reader, no exceptions.** All blog collection access goes through
  `getBlogPosts()` / `getGatedCollection()` in `src/utils/main/blogPosts.ts`.
  Never call `getCollection('foundation-blog')` directly — six readers with six
  filters is how a route set ends up disagreeing with the category pills or the
  language-switcher map, which is exactly how a scheduled post leaks. Ungated
  collections pass straight through `getGatedCollection`, so the two
  collection-agnostic callers (`getLocalizedPaths`, `buildMap`) use it too.
- **The gate cascades to translations.** Filtering each entry on its own `date`
  is not enough: `getLocalizedPaths` builds every ES route from the EN entry
  list, and nothing forces a translation to carry its original's date. A
  translation dated in the past therefore outlives a scheduled original and gets
  listed, filtered and indexed while no route exists for it — a 404 link
  (INTORG-1239). `getGatedCollection` drops any entry whose `localizes` target
  did not survive the date filter. Only inside the gated branch: a dangling
  `localizes` with the gate off is a pre-existing content bug, not this gate's
  business.
- **Gated by collection name, not field shape.** `GATED_COLLECTIONS` lists
  `foundation-blog` only. `reports` also has a `date`, but it is an object
  (`{ publishDate, lastUpdated }`) — sniffing for the field would gate the wrong
  thing. An entry with no date, or an unparseable one, always counts as
  published.
- **The mode decision is pinned at build time**, the same way the image CDN's is:
  `shouldHideFuturePosts()` (`src/utils/main/publishGate.ts`) is frozen into the
  Vite `define` `__HIDE_FUTURE_POSTS__` (`astro.config.mjs`), and
  `hideFuturePosts()` prefers the define. It reads Netlify's `CONTEXT`
  (`production` gates; `branch-deploy`, `deploy-preview` and a missing value do
  not), with `BLOG_DATE_FILTER=on|off` as an explicit override. No per-context
  env vars in `netlify.toml`.
- **`BUILD_NOW` is frozen at module load.** A build starting at 23:59:50 UTC
  would otherwise gate the listing on one day and the static paths on the next,
  emitting a post's URL with nothing linking to it.
- **UTC day boundary.** A post dated `2026-09-19` goes live at 00:00 UTC — 20:00
  on the 18th US Eastern, 02:00 on the 19th SAST. `z.coerce.date()` parses
  date-only frontmatter as UTC midnight, so any other zone means a deliberate
  offset constant.
- **Nothing publishes itself.** `output: 'static'` means the gate is evaluated
  once per build: a post dated tomorrow appears at the next _production
  promotion on or after_ its date, not at midnight. This is intentional — but
  tell comms, or scheduling looks broken. Automating it would need a daily cron
  hitting a production build hook; `scheduled-content-sync.yml` runs one already,
  but only for `staging`/`playground`.
- **`date` is overloaded.** It is both the displayed/sort date and the publish
  gate. Back-dating to push a post down the listing is safe; forward-dating to
  show a nicer date now hides it. There is no `draft` flag and no separate
  `publishDate`, so "publish now, display a future date" is not possible.
- **`/blog/preview` is unaffected** — it is SSR and fetches Strapi by
  `documentId`, bypassing the collection. That is the way to view a scheduled
  post on production.
- **Validation:** build twice with `BLOG_DATE_FILTER_AS_OF=<ISO date>` pinning
  the cutoff, rather than editing a post's date and remembering to revert it:

  ```bash
  CONTEXT=production    BLOG_DATE_FILTER_AS_OF=2026-09-01 IMAGE_CDN=on pnpm run build  # gated
  CONTEXT=branch-deploy BLOG_DATE_FILTER_AS_OF=2026-09-01 IMAGE_CDN=on pnpm run build  # all posts
  ```

  Then check `dist/blog/<slug>/index.html`, `dist/blog-search-index.json`,
  `dist/sitemap-*.xml` and `dist/blog/index.html` for the slug.

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
