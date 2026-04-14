import { translationMap } from '@/utils/translationMapData'
import { type Locale } from '@/utils/locales'
import {
  HOME_CONTENT_SLUG,
  ROUTE_BASES,
  type RouteCollection,
  localizeRoute
} from '@/utils/routes'

export const COLLECTION_INDEX_SLUG = ''

export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return ''
  return basePath.startsWith('/') ? basePath : `/${basePath}`
}

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
