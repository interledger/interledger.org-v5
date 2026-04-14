import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { BlogCollectionType } from '@/content.config'
import type { Locale } from './i18'

export function getTagUrl(path: string, tag: string) {
  return `${path}/tag/${getTagSlug(tag)}`
}

export function getTagSlug(tag: string) {
  return tag.toLowerCase().replace(/\s+/g, '-')
}

async function fetchPostsAndTags(collection: BlogCollectionType, lang: Locale) {
  const blogEntries = (
    await getCollection(collection, ({ data }) => data.locale === lang)
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  // Collect all unique tags
  const allTags = [
    ...new Set(blogEntries.flatMap((entry) => entry.data.tags))
  ].sort()

  return { blogEntries, allTags }
}

export async function paginateAllPosts({
  paginate,
  collection,
  lang
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
  lang: Locale
}) {
  const { blogEntries, allTags } = await fetchPostsAndTags(collection, lang)
  return paginate(blogEntries, {
    pageSize: 10,
    props: { allTags }
  })
}

export async function paginatePostsByTag({
  paginate,
  collection,
  lang
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
  lang: Locale
}) {
  const { blogEntries, allTags } = await fetchPostsAndTags(collection, lang)
  // Create pages for each tag
  return allTags.flatMap((tag) => {
    const tagSlug = getTagSlug(tag)
    const filteredEntries = blogEntries.filter((entry) =>
      entry.data.tags.some((t) => t === tag)
    )

    return paginate(filteredEntries, {
      params: { tag: tagSlug },
      pageSize: 10,
      props: { allTags, selectedTag: tag }
    })
  })
}
