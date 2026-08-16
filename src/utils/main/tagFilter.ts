import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import type { BlogCollectionType } from '@/content.config'
import type { Locale, UiKey } from './i18'

/**
 * Collections that expose a term taxonomy for the shared TaxonomyFilter UI.
 * foundation-blog fetches/paginates through this module's own functions
 * below; podcast-pages paginates through podcastPagination.ts instead (its
 * "entries" are one page's array field, not real per-locale collection
 * entries) but shares this same taxonomy config, URL, and label shape.
 */
export type TaxonomyCollection = BlogCollectionType | 'podcast-pages'

/**
 * A taxonomy exposes its terms under a frontmatter field, a URL segment, and a
 * set of translation keys. Kept as a small map (rather than inlined) so the
 * shared listing/filter code stays collection-agnostic across collections.
 */
export interface TermTaxonomy {
  /** Frontmatter field holding the term(s) on the entry/item. */
  field: 'categories' | 'series'
  /** URL segment for filter pages, e.g. /blog/<segment>/<slug>/. */
  segment: 'category'
  /** Translation-key prefix for individual terms, e.g. `blog.categories`. */
  i18nPrefix: 'blog.categories' | 'podcast.categories'
  /** Translation key for the filter heading. */
  filterLabelKey: UiKey
  /** Translation key for the "All" filter pill. */
  allLabelKey: UiKey
}

const TERM_TAXONOMY: Record<TaxonomyCollection, TermTaxonomy> = {
  'foundation-blog': {
    field: 'categories',
    segment: 'category',
    i18nPrefix: 'blog.categories',
    filterLabelKey: 'blog.filter.category.label',
    allLabelKey: 'blog.filter.all'
  },
  'podcast-pages': {
    field: 'series',
    segment: 'category',
    i18nPrefix: 'podcast.categories',
    filterLabelKey: 'podcast.filter.category.label',
    allLabelKey: 'podcast.filter.all'
  }
}

export function getTaxonomy(collection: TaxonomyCollection): TermTaxonomy {
  return TERM_TAXONOMY[collection]
}

/** Reads the taxonomy terms off a blog entry regardless of collection. */
function getEntryTerms(
  entry: CollectionEntry<BlogCollectionType>,
  field: TermTaxonomy['field']
): string[] {
  const value = (entry.data as Record<string, unknown>)[field]
  return Array.isArray(value) ? (value as string[]) : []
}

export function getTermSlug(term: string) {
  return term.toLowerCase().replace(/\s+/g, '-')
}

/** Routing sentinel for the canonical "all terms" filter page/URL segment. */
export const ALL_TERM_SLUG = 'all'

/** Builds the URL of a taxonomy filter page, e.g. `/blog/category/announcements`.
 *  Appends `/lang/<locale>` when contentLangOverride is set (cross-lang combo routes).
 */
export function getTermUrl(
  basePath: string,
  segment: TermTaxonomy['segment'],
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
  prefix: TermTaxonomy['i18nPrefix'],
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
  const { field } = getTaxonomy(collection)
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
      totalEntries: blogEntries.length,
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
  const { field, segment } = getTaxonomy(collection)
  const effectiveLang = contentLang ?? lang
  const { blogEntries, allTerms, enabledTerms } = await fetchPostsAndTerms(
    collection,
    effectiveLang
  )

  const termPaths = allTerms.flatMap((term) => {
    const termSlug = getTermSlug(term)
    const filteredEntries = blogEntries.filter((entry) =>
      getEntryTerms(entry, field).some((t) => t === term)
    )

    const langParam = contentLang ? { contentLang } : undefined

    // When no posts match the term+lang combo, paginate all lang posts as a
    // fallback so the page renders with content rather than 404 or an empty
    // list. The term stays in the URL so switching back to the other lang
    // preserves the filter.
    const pageEntries =
      filteredEntries.length > 0 ? filteredEntries : blogEntries
    const isTermFallback = filteredEntries.length === 0

    return paginate(pageEntries, {
      params: { [segment]: termSlug, ...langParam },
      pageSize: 10,
      props: {
        allTerms,
        totalEntries: pageEntries.length,
        enabledTerms: [...enabledTerms],
        selectedTerm: term,
        contentLang: effectiveLang,
        isTermFallback
      }
    })
  })

  // Generate /<segment>/all (or /<segment>/all/lang/<locale>) so the "All"
  // filter button has a canonical URL on both simple and cross-lang routes.
  const allParams = contentLang
    ? { [segment]: ALL_TERM_SLUG, contentLang }
    : { [segment]: ALL_TERM_SLUG }

  const allPath = paginate(blogEntries, {
    params: allParams,
    pageSize: 10,
    props: {
      allTerms,
      totalEntries: blogEntries.length,
      enabledTerms: [...enabledTerms],
      selectedTerm: undefined,
      contentLang: effectiveLang,
      isTermFallback: false
    }
  })

  return [...termPaths, ...allPath]
}
