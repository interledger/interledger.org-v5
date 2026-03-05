import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { BlogCollectionType } from '@/content.config'

export function getTagUrl(path: string, tag: string) {
  const slug = tag.toLowerCase().replace(/\s+/g, '-')
  return `${path}/tag/${slug}`
}

export function getTagSlug(tag: string) {
  return tag.toLowerCase().replace(/\s+/g, '-')
}

export async function getTagFilteredPosts({
  paginate,
  collection
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
}) {
  const blogEntries = (await getCollection(collection)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )

  // Collect all unique tags
  const allTags = [
    ...new Set(blogEntries.flatMap((entry) => entry.data.tags))
  ].sort()

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
