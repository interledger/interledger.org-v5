import { getCollection } from 'astro:content'
import type { Locale } from '@/utils/i18'

type PageCollection = 'foundation-pages' | 'summit-pages'

export async function getPagePaths(
  collection: PageCollection,
  lang: Locale,
  options?: { excludeSlug?: string }
) {
  const pages = await getCollection(collection)
  return pages
    .filter((page) => page.data.locale === lang)
    .filter(
      (page) =>
        !options?.excludeSlug || page.data.pathSlug !== options.excludeSlug
    )
    .map((page) => ({
      params: { page: page.data.pathSlug }
    }))
}
