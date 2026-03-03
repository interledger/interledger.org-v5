import { getCollection } from 'astro:content'
import type { Locale } from 'src/i18/utils'

type PageCollection = 'foundation-pages' | 'summit-pages'

export async function getPagePaths(
  collection: PageCollection,
  lang: Locale,
  options?: { excludeSlug?: string }
) {
  const pages = await getCollection(collection)
  // to do remove
  const preview = pages
    .filter((page) => page.data.lang === lang)
    .filter(
      (page) => !options?.excludeSlug || page.data.pathSlug !== options.excludeSlug
    )
    .map((page) => ({
      params: { page: page.data.pathSlug }
    }))
    console.log('GETPAGEPATHS: ', preview)
  //
  return pages
    .filter((page) => page.data.lang === lang)
    .filter(
      (page) => !options?.excludeSlug || page.data.pathSlug !== options.excludeSlug
    )
    .map((page) => ({
      params: { page: page.data.pathSlug }
    }))
}
