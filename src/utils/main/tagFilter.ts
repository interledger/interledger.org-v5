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

/** Builds the URL of a taxonomy filter page, e.g. `/blog/category/announcements`.
 *  Cross-lang combo routes always use "tag" as the generic URL segment, so we
 *  switch to it whenever a contentLangOverride is present.
 */
export function getTermUrl(
  basePath: string,
  segment: BlogTaxonomy['segment'],
  term: string,
  contentLangOverride?: Locale
) {
  const slug = getTermSlug(term)
  if (contentLangOverride) {
    return `${basePath}/${segment}/${slug}/lang/${contentLangOverride}`
  }
  return `${basePath}/${segment}/${slug}`
}

/**
 * Builds the EN and ES hrefs for the content-language toggle buttons/links.
 * Both links always use the /lang/<locale> URL form so the selection is
 * reflected in the URL and stays sticky through subsequent navigation
 * (taxonomy filter, All button, language switcher).
 */
export function buildContentLangHrefs(
  blogIndexHref: string,
  selectedTerm?: string
): { enHref: string; esHref: string } {
  const crossLangBase = selectedTerm
    ? `${blogIndexHref}/category/${getTermSlug(selectedTerm)}`
    : blogIndexHref
  return {
    enHref: `${crossLangBase}/lang/en`,
    esHref: `${crossLangBase}/lang/es`
  }
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
  const allEntries = (await getCollection(collection)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )
  const blogEntries = allEntries.filter((entry) => entry.data.locale === lang)
  // Collect all unique terms across posts
  const allTerms = [
    ...new Set(allEntries.flatMap((entry) => getEntryTerms(entry, field)))
  ].sort()

  const enabledTerms = new Set(
    blogEntries.flatMap((entry) => getEntryTerms(entry, field))
  )

  return { blogEntries, allTerms, enabledTerms }
}

export async function paginateAllPosts({
  paginate,
  collection,
  lang,
  contentLang
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
  lang: Locale
  contentLang?: Locale
}) {
  const effectiveLang = contentLang ?? lang
  const { blogEntries, allTerms, enabledTerms } = await fetchPostsAndTerms(
    collection,
    effectiveLang
  )
  const langParam = contentLang ? { contentLang } : undefined
  return paginate(blogEntries, {
    params: langParam,
    pageSize: 10,
    props: {
      allTerms,
      enabledTerms: [...enabledTerms],
      contentLang: effectiveLang
    }
  })
}

export async function paginatePostsByTerm({
  paginate,
  collection,
  lang,
  contentLang
}: {
  paginate: PaginateFunction
  collection: BlogCollectionType
  lang: Locale
  contentLang?: Locale
}) {
  const { field, segment } = getBlogTaxonomy(collection)
  const effectiveLang = contentLang ?? lang
  const { blogEntries, allTerms, enabledTerms } = await fetchPostsAndTerms(
    collection,
    effectiveLang
  )

  // For combined term+lang routes the URL segment is always "tag" (generic);
  // for term-only routes it matches the collection's taxonomy segment.
  const termParamKey = segment

  const termPaths = allTerms.flatMap((tag) => {
    const termSlug = getTermSlug(tag)
    const filteredEntries = blogEntries.filter((entry) =>
      getEntryTerms(entry, field).some((t) => t === tag)
    )

    const langParam = contentLang ? { contentLang } : undefined

    // When no posts match the tag+lang combo, paginate all lang posts as a fallback
    // so the page renders with content rather than 404 or an empty list. The tag
    // stays in the URL so switching back to the other lang preserves the filter.
    const pageEntries =
      filteredEntries.length > 0 ? filteredEntries : blogEntries
    const isTermFallback = filteredEntries.length === 0

    return paginate(pageEntries, {
      params: { [termParamKey]: termSlug, ...langParam },
      pageSize: 10,
      props: {
        allTerms,
        enabledTerms: [...enabledTerms],
        selectedTerm: tag,
        contentLang: effectiveLang,
        isTermFallback
      }
    })
  })

  // Generate /<segment>/all (or /tag/all/lang/<locale>) so the "All" filter button
  // has a canonical URL on both simple and cross-lang routes.
  const allParams = contentLang
    ? { [termParamKey]: 'all', contentLang }
    : { [termParamKey]: 'all' }

  const allPath = paginate(blogEntries, {
    params: allParams,
    pageSize: 10,
    props: {
      allTerms,
      enabledTerms: [...enabledTerms],
      selectedTerm: undefined,
      contentLang: effectiveLang,
      isTermFallback: false
    }
  })

  return [...termPaths, ...allPath]
}
