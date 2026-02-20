# Developer Practices

## Project
- Stack: Astro, Tailwind, Strapi, TypeScript
- Mobile-first design
- Astro is the source of truth for content; keep the Strapi editor interface minimal

## Code Style
- Optimize for the next reader. Clarity over cleverness.
- Name things well — good names reduce the need for comments
- Keep functions small and focused. If a function can't be described in one sentence, it's doing too much
- Functions over 50 lines are likely doing too much — suggest splitting
- Prefer early returns over deep nesting
- No magic numbers or hardcoded strings — use named constants
- Extract repeated logic into well-named utilities
- Avoid mixing concerns (data fetching + transformation + rendering + side effects) in one function

## TypeScript
- Use strict typing everywhere
- Prefer compile-time errors over runtime errors

## Styling
- Use Tailwind utility classes
- Prefer shared components and design tokens over one-off styles
- No one-off styling where a shared component exists

## Dependencies
- Before suggesting a new dependency, check if something already in the project solves it
- Only suggest actively maintained, widely-used packages
- Always suggest the latest stable version
- Flag if a dependency seems unnecessary

## Error Handling & Edge Cases
- Always consider edge cases and error states
- Add error handling by default

## Accessibility
- Accessibility is non-negotiable
- Use semantic HTML
- Ensure keyboard navigability and visible focus states
- Add aria attributes only when semantic HTML isn't sufficient
- Consider zoom and screen reader behavior

## Performance
- Watch bundle size
- Prefer static output
- Avoid unnecessary rerenders
- Lazy-load where appropriate
- Optimize assets before committing

## Code Review Mindset
- Generate code as if it will be reviewed by a senior engineer
- Don't solve the local problem while breaking the global structure
- Keep changes focused — one idea per output
- Comments should be correct, necessary, and non-obvious. Remove any that just describe what the code does.

## When Asked to Generate Code
- Produce clean, readable, well-named, strongly typed code by default
- Suggest splitting if a function is getting long
- Flag any tradeoffs or edge cases in the implementation
- If a new dependency is needed, explain why and confirm no existing alternative exists

## Self-Critique
- When asked to review or audit code, check for: edge cases, accessibility, performance, error handling, naming clarity, unnecessary complexity, and mixed concerns
