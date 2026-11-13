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
 * Builds a blog post's href. The locale defaults to the post's own content
 * locale. Pass the page's routeLocale to keep the link on the reader's site
 * when the post is an EN fallback: every EN post has an `/es/` route.
 */
export function getBlogPostPath(
  post: CollectionEntry<'foundation-blog'>,
  locale: Locale = (post.data.locale as Locale | undefined) ?? defaultLocale
): string {
  return translatePath('foundation-blog', locale, post.data.pathSlug)
}
