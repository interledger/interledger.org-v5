import { getCollection } from 'astro:content'

type PageCollection = 'foundation-pages' | 'summit-pages'

export async function getPagePaths(
  collection: PageCollection,
  options?: { excludeSlug?: string }
) {
  const pages = await getCollection(collection)
  return pages
    .filter(
      (page) => !options?.excludeSlug || page.data.slug !== options.excludeSlug
    )
    .map((page) => ({
      params: { page: page.data.slug }
    }))
}
