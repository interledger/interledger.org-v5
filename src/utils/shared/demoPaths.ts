/**
 * Demo content pages (e.g. `demo-foundation-page`) are for design/QA only.
 * Path slugs that start with `demo-` (or are exactly `demo`) are treated as
 * non-indexed, and matching URL path segments are excluded from the sitemap.
 */
export function isDemoPathSlug(pathSlug: string | undefined | null): boolean {
  if (!pathSlug) return false
  const slug = pathSlug.replace(/^\/+|\/+$/g, '')
  return slug === 'demo' || slug.startsWith('demo-') || slug.includes('/demo-')
}

/** True when any path segment is a demo slug (for sitemap + pathname checks). */
export function isDemoPathname(pathname: string): boolean {
  return pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => segment === 'demo' || segment.startsWith('demo-'))
}
