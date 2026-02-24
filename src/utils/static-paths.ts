import { getCollection } from 'astro:content'
import type { Locale } from 'src/i18/utils'

type PageCollection = 'foundation-pages' | 'summit-pages'

export async function getPagePaths(
  collection: PageCollection,
  lang: Locale,
  options?: { excludeSlug?: string }
) {
  const pages = await getCollection(collection)
  return pages
    .filter((page) => page.data.lang === lang)
    .filter(
      (page) => !options?.excludeSlug || page.data.slug !== options.excludeSlug
    )
    .map((page) => ({
      params: { page: page.data.slug }
    }))
}
