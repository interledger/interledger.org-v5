import type { SearchIndexEntry } from '../../types/foundationBlogSearch'

export function searchFoundationBlog(
  index: SearchIndexEntry[],
  query: string
): SearchIndexEntry[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const terms = trimmed.toLowerCase().split(/\s+/)

  return index.filter((entry) => {
    const haystack = [
      entry.title,
      entry.description,
      entry.excerpt,
      entry.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase()

    return terms.every((term) => haystack.includes(term))
  })
}
