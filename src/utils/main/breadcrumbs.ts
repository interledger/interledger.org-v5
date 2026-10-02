import {
  localizeRoute,
  HACKATHON_HOME_SLUG,
  grantOverviewHubPath
} from './routes'
import type { Locale, UiKey, useTranslations } from './i18'
import type { SiteSection } from './static-paths'

export type BreadcrumbItem = {
  name: string
  href: string
}

/**
 * Path prefixes that carry no page of their own, mapped to the landing page a
 * breadcrumb must link to instead. `/hackathon` has no page at its route base
 * (see MicrositeHeader), and `/grant` is a route prefix whose hub page lives
 * at `/grant/our-grantmaking`.
 */
const ROOT_LANDING_PATHS: Record<string, string> = {
  hackathon: `hackathon/${HACKATHON_HOME_SLUG}`,
  grant: grantOverviewHubPath()
}

type Translate = ReturnType<typeof useTranslations>

/**
 * Paths whose crumb label comes from the UI strings instead of the slug, so
 * it is localized. Keyed by path like ROOT_LANDING_PATHS, so a nested
 * `summit/grant` keeps its slug label. `grant` reuses the label GrantPage
 * gives the same hub link, `grant/fellowship` the navigation's label.
 */
const SEGMENT_LABEL_KEYS: Record<string, UiKey> = {
  grant: 'nav.grants',
  'grant/fellowship': 'breadcrumb.grant.fellowship'
}

function toLabel(segmentPath: string, segment: string, t: Translate): string {
  const labelKey = SEGMENT_LABEL_KEYS[segmentPath]
  if (labelKey) return t(labelKey)

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
  t: Translate
): BreadcrumbItem[] {
  const sectionPrefix = section && section !== 'foundation' ? section : ''
  const fullPath = [sectionPrefix, pathSlug].filter(Boolean).join('/')
  const parentParts = fullPath.split('/').slice(0, -1)

  return [
    { name: t('nav.home'), href: localizeRoute('', routeLocale) },
    ...parentParts.map((_, i) => {
      const segmentPath = parentParts.slice(0, i + 1).join('/')

      return {
        name: toLabel(segmentPath, parentParts[i], t),
        href: localizeRoute(
          ROOT_LANDING_PATHS[segmentPath] ?? segmentPath,
          routeLocale
        )
      }
    }),
    { name: label, href: localizeRoute(fullPath, routeLocale) }
  ]
}
