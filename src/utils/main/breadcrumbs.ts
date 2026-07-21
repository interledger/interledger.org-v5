import { localizeRoute } from './routes'
import type { Locale } from './i18'
import type { SiteSection } from './static-paths'

export type BreadcrumbItem = {
  name: string
  href: string
}

function toLabel(segment: string): string {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Builds Home > [section base?] > [pathSlug parents] > label breadcrumbs for
 * a cross-section template entry (profiles, reports). `section` only
 * contributes a URL prefix outside `foundation`, matching how these entries
 * are routed.
 *
 * `routeLocale` must be the URL locale (`Astro.locals.routeLocale`), not the
 * locale of the content entry being rendered. On a localized route that
 * falls back to EN content (`isFallback`), those two differ — using the
 * content locale here would generate non-localized hrefs (e.g. `/grant/faq`
 * instead of `/es/grant/faq`) and bounce visitors out of the localized site.
 */
export function buildSectionEntryBreadcrumbs(
  pathSlug: string,
  section: SiteSection | null | undefined,
  label: string,
  routeLocale: Locale,
  homeLabel: string
): BreadcrumbItem[] {
  const sectionPrefix = section && section !== 'foundation' ? section : ''
  const fullPath = [sectionPrefix, pathSlug].filter(Boolean).join('/')
  const parentParts = fullPath.split('/').slice(0, -1)

  return [
    { name: homeLabel, href: localizeRoute('', routeLocale) },
    ...parentParts.map((_, i) => ({
      name: toLabel(parentParts[i]),
      href: localizeRoute(parentParts.slice(0, i + 1).join('/'), routeLocale)
    })),
    { name: label, href: localizeRoute(fullPath, routeLocale) }
  ]
}
