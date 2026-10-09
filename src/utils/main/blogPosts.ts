import type { CollectionEntry } from 'astro:content'
import type { BlogCollectionType } from '@/content.config'
import { sortByPublishDateDesc } from './blog'
import { getGatedCollection } from './gatedCollection'
import type { Locale } from './locales'

/**
 * Blog posts, gated and newest-first, optionally scoped to one content locale.
 *
 * This is what every blog reader should call. Sorting here rather than at each
 * call site is deliberate: the listing order is a property of the collection,
 * not of whoever happens to be rendering it.
 */
export async function getBlogPosts({
  collection = 'foundation-blog',
  locale
}: {
  collection?: BlogCollectionType
  locale?: Locale
} = {}): Promise<CollectionEntry<'foundation-blog'>[]> {
  const entries = await getGatedCollection(collection)
  const scoped = locale
    ? entries.filter((entry) => entry.data.locale === locale)
    : entries

  return sortByPublishDateDesc(scoped)
}
