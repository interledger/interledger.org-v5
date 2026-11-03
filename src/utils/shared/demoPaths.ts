import { trimSlashes } from './url'

/**
 * Demo content pages (e.g. `demo-foundation-page`) are for design/QA only.
 * Path slugs that start with `demo-` (or are exactly `demo`) are treated as
 * non-indexed, and matching URL path segments are excluded from the sitemap.
 */
export function isDemoPathSlug(pathSlug: string | undefined | null): boolean {
  if (!pathSlug) return false
  const slug = trimSlashes(pathSlug)
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

/**
 * Preview/QA routes (design-system previews, draft-content previews like
 * `page-preview`/`profile-preview`/`blog/preview`) aren't real traffic —
 * used to gate analytics so QA clicks never mix into production data.
 */
export function isPreviewPathname(pathname: string): boolean {
  return pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => segment === 'preview' || segment.endsWith('-preview'))
}

/**
 * Pages the XML sitemap leaves out: preview routes and demo pages. Uses the
 * same preview rule as analytics and hreflang, so `/page-preview/` and
 * `/profile-preview/` are excluded along with everything under `/preview/`.
 *
 * Side effect: the rule matches any path segment ending in `-preview`, so a
 * content page with such a slug (say `/grant/program-preview/`) is left out of
 * the sitemap too, with no warning. No slug ends that way today. Give such a
 * page another slug, or narrow this rule to the preview routes.
 */
export function isExcludedFromSitemap(pathname: string): boolean {
  return isPreviewPathname(pathname) || isDemoPathname(pathname)
}
