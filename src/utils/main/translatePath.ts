import type { CollectionEntry } from 'astro:content'
import { translationMap } from './translationMapData'
import { defaultLocale, type Locale } from './locales'
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

/**
 * Builds a blog post's href using its own content locale rather than the
 * current page's routeLocale since we can display blogs of one language on a page of another language.
 */
export function getBlogPostPath(
  post: CollectionEntry<'foundation-blog'>
): string {
  const locale = (post.data.locale as Locale | undefined) ?? defaultLocale
  return translatePath('foundation-blog', locale, post.data.pathSlug)
}
