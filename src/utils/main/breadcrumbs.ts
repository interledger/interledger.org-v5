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
 * a cross-section template entry (profiles, faqs). `section` only
 * contributes a URL prefix outside `foundation`, matching how these entries
 * are routed.
 *
 * `urlLocale` must be the locale of the URL being rendered (e.g.
 * `Astro.locals.routeLocale`), not the content locale. On a localized route
 * that falls back to EN content (`isFallback`), the content locale is `en`
 * but the page still lives under the localized URL prefix (e.g. `/es/...`) —
 * using the content locale here would generate non-localized breadcrumb
 * hrefs and bounce the visitor out of the localized section.
 */
export function buildSectionEntryBreadcrumbs(
  pathSlug: string,
  section: SiteSection | null | undefined,
  label: string,
  urlLocale: Locale,
  homeLabel: string
): BreadcrumbItem[] {
  const sectionPrefix = section && section !== 'foundation' ? section : ''
  const fullPath = [sectionPrefix, pathSlug].filter(Boolean).join('/')
  const parentParts = fullPath.split('/').slice(0, -1)

  return [
    { name: homeLabel, href: localizeRoute('', urlLocale) },
    ...parentParts.map((_, i) => ({
      name: toLabel(parentParts[i]),
      href: localizeRoute(parentParts.slice(0, i + 1).join('/'), urlLocale)
    })),
    { name: label, href: localizeRoute(fullPath, urlLocale) }
  ]
}
