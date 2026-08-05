/**
 * Demo content pages (e.g. `demo-foundation-page`) are for design/QA only.
 * Path slugs that start with `demo-` (or are exactly `demo`) are treated as
 * non-indexed, and matching URL path segments are excluded from the sitemap.
 */
export function isDemoPathSlug(pathSlug: string | undefined | null): boolean {
  if (!pathSlug) return false
  const slug = pathSlug.replace(/^\/+|\/+$/g, '')
  // Match path segments (slugs can include nested `/` segments), same rule as
  // isDemoPathname so sitemap exclusion and noindex stay aligned.
  return slug
    .split('/')
    .filter(Boolean)
    .some((segment) => segment === 'demo' || segment.startsWith('demo-'))
}

/** True when any path segment is a demo slug (for sitemap + pathname checks). */
export function isDemoPathname(pathname: string): boolean {
  return pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => segment === 'demo' || segment.startsWith('demo-'))
}
