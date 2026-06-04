import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import type { BlogCollectionType } from '@/content.config'
import type { Locale, UiKey } from './i18'

/**
 * Each blog collection exposes a taxonomy under a different field and surfaces
 * it on a different URL segment and set of translation keys. The foundation
 * blog uses "categories"; the developer blog still uses "tags". Keeping this
 * map here lets the shared listing/filter code stay collection-agnostic.
 */
export interface BlogTaxonomy {
  /** Frontmatter field holding the term list on the collection entry. */
  field: 'categories' | 'tags'
  /** URL segment for filter pages, e.g. /blog/<segment>/<slug>/. */
  segment: 'category' | 'tag'
  /** Translation-key prefix for individual terms, e.g. `blog.categories`. */
  i18nPrefix: 'blog.categories' | 'blog.tags'
  /** Translation key for the filter heading. */
  filterLabelKey: UiKey
}

const BLOG_TAXONOMY: Record<BlogCollectionType, BlogTaxonomy> = {
  'foundation-blog': {
    field: 'categories',
    segment: 'category',
    i18nPrefix: 'blog.categories',
    filterLabelKey: 'blog.filter.category.label'
  },
  'developers-blog': {
    field: 'tags',
    segment: 'tag',
    i18nPrefix: 'blog.tags',
    filterLabelKey: 'blog.filter.tag.label'
  }
}

export function getBlogTaxonomy(collection: BlogCollectionType): BlogTaxonomy {
  return BLOG_TAXONOMY[collection]
}

/** Reads the taxonomy terms off a blog entry regardless of collection. */
function getEntryTerms(
  entry: CollectionEntry<BlogCollectionType>,
  field: BlogTaxonomy['field']
): string[] {
  const value = (entry.data as Record<string, unknown>)[field]
  return Array.isArray(value) ? (value as string[]) : []
}

export function getTermSlug(term: string) {
  return term.toLowerCase().replace(/\s+/g, '-')
}

/** Builds the URL of a taxonomy filter page, e.g. `/blog/category/announcements`. */
export function getTermUrl(
  basePath: string,
  segment: BlogTaxonomy['segment'],
  term: string
) {
  return `${basePath}/${segment}/${getTermSlug(term)}`
}

export function translateTerm(
  prefix: BlogTaxonomy['i18nPrefix'],
  term: string,
  t: (key: UiKey) => string
): string {
  const key = `${prefix}.${getTermSlug(term)}` as UiKey
  return t(key) || term
}

async function fetchPostsAndTerms(
  collection: BlogCollectionType,
  lang: Locale
) {
  const { field } = getBlogTaxonomy(collection)
  const blogEntries = (
    await getCollection(collection, ({ data }) => data.locale === lang)
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  // Collect all unique terms across posts
  const allTerms = [
    ...new Set(blogEntries.flatMap((entry) => getEntryTerms(entry, field)))
  ].sort()

  return { blogEntries, allTerms }
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
  const { blogEntries, allTerms } = await fetchPostsAndTerms(collection, lang)
  return paginate(blogEntries, {
    pageSize: 10,
    props: { allTerms }
  })
}

export async function paginatePostsByTerm({
  paginate,
  collection,
  lang
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
  lang: Locale
}) {
  const { field, segment } = getBlogTaxonomy(collection)
  const { blogEntries, allTerms } = await fetchPostsAndTerms(collection, lang)
  // Create a paginated set of pages for each term
  return allTerms.flatMap((term) => {
    const termSlug = getTermSlug(term)
    const filteredEntries = blogEntries.filter((entry) =>
      getEntryTerms(entry, field).some((t) => t === term)
    )

    return paginate(filteredEntries, {
      params: { [segment]: termSlug },
      pageSize: 10,
      props: { allTerms, selectedTerm: term }
    })
  })
}
