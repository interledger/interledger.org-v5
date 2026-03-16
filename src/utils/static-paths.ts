import { getCollection } from 'astro:content'
import type { Locale } from '@/utils/i18'

type collectionType =
  | 'foundation-pages'
  | 'summit-pages'
  | 'foundation-blog'
  | 'developers-blog'

export async function getLocalizedPaths(
  collection: collectionType,
  lang: Locale,
  paramName: string,
  options?: { excludeSlug?: string }
) {
  const entries = await getCollection(collection)
  return entries
    .filter((entry) => entry.data.locale === lang)
    .filter(
      (entry) =>
        !options?.excludeSlug || entry.data.pathSlug !== options.excludeSlug
    )
    .map((entry) => ({
      params: { [paramName]: entry.data.pathSlug }
    }))
}
