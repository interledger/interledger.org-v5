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

- **Always check `src/utils/` before writing a new utility function.** Read `src/utils/README.md` for a module-by-module summary, then scan the relevant file before implementing anything yourself.
- If a utility already exists, import it — never duplicate it inline.
- If you add a new utility function:
  1. Put it in the most semantically appropriate existing module, or create a new one if no good fit exists.
  2. Add an explicit named export for it in `src/utils/index.ts` under the correct group comment.
  3. Add a row for it in `src/utils/README.md` in the correct table.
- `src/utils/paths.ts` is a CMS-only Node.js utility — do not import it in Astro components.

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
