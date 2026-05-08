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
