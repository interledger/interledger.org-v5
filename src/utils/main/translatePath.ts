import { translationMap } from './translationMapData'
import { type Locale } from './locales'
import {
  HOME_CONTENT_SLUG,
  ROUTE_BASES,
  type RouteCollection,
  localizeRoute,
  normalizeBasePath
} from './routes'

export const COLLECTION_INDEX_SLUG = ''

export function buildRoutePath(basePath: string, enSlug: string): string {
  const normalizedBase = normalizeBasePath(basePath)
  if (enSlug === HOME_CONTENT_SLUG) return normalizedBase
  return enSlug ? `${normalizedBase}/${enSlug}` : normalizedBase
}

export function translatePath(
  routeBase: RouteCollection,
  locale: Locale,
  enSlug: string
): string {
  const entry = translationMap[enSlug]
  const localizedSlug = entry?.[locale] ?? enSlug
  const basePath = ROUTE_BASES[routeBase]

  return localizeRoute(buildRoutePath(basePath, localizedSlug), locale)
}
