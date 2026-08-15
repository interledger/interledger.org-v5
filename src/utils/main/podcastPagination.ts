import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import { defaultLocale, type Locale } from './i18'
import { PODCAST_PAGE_SLUG } from './routes'

// Matches the blog listing's page size (src/utils/main/tagFilter.ts) so both
// SSG listings paginate at the same cadence.
export const PODCAST_PAGE_SIZE = 5

export type PodcastPageData = CollectionEntry<'podcast-pages'>['data']

async function findPodcastPage(
  lang: Locale
): Promise<CollectionEntry<'podcast-pages'> | undefined> {
  const pages = await getCollection('podcast-pages')
  return pages.find(
    (page) =>
      page.data.pathSlug === PODCAST_PAGE_SLUG && page.data.locale === lang
  )
}

/**
 * Paginates the single podcast page's `podcasts` array for the SSG listing at
 * /podcast (and /es/podcast). There is exactly one podcast-pages entry per
 * locale — episodes are page-owned frontmatter, not a separate collection —
 * so pagination slices that one array rather than querying multiple entries.
 *
 * ES falls back to the EN entry when no ES translation exists yet, mirroring
 * the EN-canonical / ES-fallback rule used by getLocalizedPaths.
 */
export async function paginatePodcastEpisodes({
  paginate,
  lang
}: {
  paginate: PaginateFunction
  lang: Locale
}) {
  const localizedPage = await findPodcastPage(lang)
  const mdxPage = localizedPage ?? (await findPodcastPage(defaultLocale))

  if (!mdxPage) return []

  const contentLocale = localizedPage ? lang : defaultLocale
  const isFallback = !localizedPage

  // Authored oldest -> newest; newest episode shows first.
  const episodes = [...mdxPage.data.podcasts].reverse()

  return paginate(episodes, {
    pageSize: PODCAST_PAGE_SIZE,
    props: {
      podcastPage: mdxPage.data,
      contentLocale,
      isFallback
    }
  })
}
