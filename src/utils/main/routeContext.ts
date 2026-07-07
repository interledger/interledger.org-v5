import { defaultLocale, locales, type Locale } from './i18'
import { HOME_CONTENT_SLUG, ROUTE_BASES } from './routes'
import { stripTrailingSlash } from '../shared/url'
import { translationMap } from './translationMapData'

const prefixedLocales = new Set(
  locales.filter((l) => l !== defaultLocale)
) as Set<Locale>

type RouteContext = {
  routeLocale: Locale
  currentSlug: string
  currentBasePath: string
}

/**
 * Derives language-switcher context from the request URL.
 * Used by middleware so layouts/components read Astro.locals instead of props.
 */
export function routeContextFromPathname(pathname: string): RouteContext {
  const path = stripTrailingSlash(pathname)

  const segments = path.split('/').filter(Boolean)

  let routeLocale: Locale = defaultLocale
  let pathSegments = segments

  if (segments[0] && prefixedLocales.has(segments[0] as Locale)) {
    routeLocale = segments[0] as Locale
    pathSegments = segments.slice(1)
  }

  const restPath =
    pathSegments.length === 0 ? '/' : `/${pathSegments.join('/')}`

  if (restPath === '/') {
    return {
      routeLocale,
      currentSlug: HOME_CONTENT_SLUG,
      currentBasePath: ''
    }
  }

  const bases = Object.values(ROUTE_BASES)
    .filter((b) => b.length > 0)
    .sort((a, b) => b.length - a.length)

  for (const base of bases) {
    if (restPath === base) {
      return { routeLocale, currentSlug: '', currentBasePath: base }
    }
    if (restPath.startsWith(`${base}/`)) {
      const currentSlug = restPath.slice(base.length + 1)
      const fullSlug = restPath.slice(1)
      // Profiles and foundation grant pages use full pathSlugs in the translation
      // map, while ROUTE_BASES still splits /grant/... for grant template pages.
      if (translationMap[fullSlug] && !translationMap[currentSlug]) {
        return { routeLocale, currentSlug: fullSlug, currentBasePath: '' }
      }
      return {
        routeLocale,
        currentSlug,
        currentBasePath: base
      }
    }
  }

  return {
    routeLocale,
    currentSlug: restPath.slice(1),
    currentBasePath: ''
  }
}
