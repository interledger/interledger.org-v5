import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import { defaultLocale, type Locale } from './locales'
import { PODCAST_PAGE_SLUG } from './routes'
import { getTermSlug, ALL_TERM_SLUG, CATEGORY_SEGMENT } from './tagFilter'
import type { PaginatedRouteShape } from './paginatedRouteShape'
import type { Podcast } from '@/types/podcast'

// Smaller than the blog listing's pageSize (10, src/utils/main/tagFilter.ts):
// each episode embeds a live iframe, so a shorter page keeps iframe count
// per view down for better performance.
export const PODCAST_PAGE_SIZE = 5

export type PodcastPageData = CollectionEntry<'podcast-pages'>['data']

function findPodcastPage(
  pages: CollectionEntry<'podcast-pages'>[],
  lang: Locale
): CollectionEntry<'podcast-pages'> | undefined {
  return pages.find(
    (page) =>
      page.data.pathSlug === PODCAST_PAGE_SLUG && page.data.locale === lang
  )
}

/**
 * Recognizes podcast's paginated URL shapes so a language-switch link can
 * safely drop a trailing page number: bare `podcast[/<n>]` and
 * `podcast/category/<name>[/<n>]`. Podcast isn't registered in ROUTE_BASES
 * (its slug is always the fixed PODCAST_PAGE_SLUG, never translated), so its
 * whole path — including the literal leading "podcast" segment — ends up in
 * the slug this shape matches against, one level deeper than blog's.
 */
export const podcastRouteShape: PaginatedRouteShape = {
  matches: (basePath, parts) =>
    basePath === '' && parts[0] === PODCAST_PAGE_SLUG,
  isValidListingPrefix: (prefixParts) => {
    const rest = prefixParts.slice(1)
    if (rest.length === 0) return true
    return rest.length === 2 && rest[0] === CATEGORY_SEGMENT
  }
}

interface ResolvedPodcastPage {
  podcastPage: PodcastPageData
  isFallback: boolean
  episodes: Podcast[]
  allTerms: string[]
}

/**
 * Resolves the single podcast-pages entry for `lang` (falling back to the EN
 * entry when no translation exists yet, mirroring the EN-canonical /
 * ES-fallback rule used by getLocalizedPaths) and its episode list, ready to
 * paginate — either as-is or filtered by series.
 */
async function resolvePodcastPage(
  lang: Locale
): Promise<ResolvedPodcastPage | null> {
  const pages = await getCollection('podcast-pages')
  const localizedPage = findPodcastPage(pages, lang)
  const mdxPage = localizedPage ?? findPodcastPage(pages, defaultLocale)

  if (!mdxPage) return null

  const episodes = [...mdxPage.data.podcasts].reverse()

  return {
    podcastPage: mdxPage.data,
    isFallback: !localizedPage,
    episodes,
    allTerms: [...new Set(episodes.map((episode) => episode.series))].sort()
  }
}

/**
 * Paginates the single podcast page's `podcasts` array for the SSG listing at
 * /podcast (and /es/podcast). There is exactly one podcast-pages entry per
 * locale — episodes are page-owned frontmatter, not a separate collection —
 * so pagination slices that one array rather than querying multiple entries.
 */
export async function paginatePodcastEpisodes({
  paginate,
  lang
}: {
  paginate: PaginateFunction
  lang: Locale
}) {
  const resolved = await resolvePodcastPage(lang)
  if (!resolved) return []

  const { episodes, ...baseProps } = resolved

  return paginate(episodes, {
    pageSize: PODCAST_PAGE_SIZE,
    props: baseProps
  })
}

/**
 * Paginates the podcast episodes per `series`, one path set per term plus a
 * canonical /podcast/category/all set — mirrors paginatePostsByTerm's shape
 * for the blog. Switching categories always lands on that category's page 1,
 * since getTermUrl (and the "all" href) never carry a page number.
 */
export async function paginatePodcastEpisodesByTerm({
  paginate,
  lang
}: {
  paginate: PaginateFunction
  lang: Locale
}) {
  const resolved = await resolvePodcastPage(lang)
  if (!resolved) return []

  const { episodes, ...baseProps } = resolved

  const termPaths = baseProps.allTerms.flatMap((term) => {
    const filteredEpisodes = episodes.filter(
      (episode) => episode.series === term
    )

    return paginate(filteredEpisodes, {
      params: { category: getTermSlug(term) },
      pageSize: PODCAST_PAGE_SIZE,
      props: { ...baseProps, selectedTerm: term }
    })
  })

  const allPath = paginate(episodes, {
    params: { category: ALL_TERM_SLUG },
    pageSize: PODCAST_PAGE_SIZE,
    props: { ...baseProps, selectedTerm: undefined }
  })

  return [...termPaths, ...allPath]
}
