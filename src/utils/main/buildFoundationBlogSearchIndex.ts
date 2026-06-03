import { getCollection } from 'astro:content'
import { createExcerpt } from './create-excerpt'
import type { SearchIndexEntry } from '../../types/foundationBlogSearch'
import type { Locale } from './locales'

const EXCERPT_LENGTH = 500

export async function buildFoundationBlogSearchIndex(
  lang: Locale
): Promise<SearchIndexEntry[]> {
  const entries = (
    await getCollection('foundation-blog', ({ data }) => data.locale === lang)
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime())

  return entries.map((entry) => ({
    title: entry.data.title,
    description: entry.data.description,
    pathSlug: entry.data.pathSlug,
    date: entry.data.date.toISOString(),
    tags: [...entry.data.tags],
    excerpt: createExcerpt(entry.body ?? '').substring(0, EXCERPT_LENGTH),
    thumbnailImage: entry.data.thumbnailImage,
    thumbnailImageAlt: entry.data.thumbnailImageAlt ?? undefined,
  }))
}
