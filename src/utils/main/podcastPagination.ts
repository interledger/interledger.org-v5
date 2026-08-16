import type { PaginateFunction } from 'astro'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import { defaultLocale, type Locale } from './locales'
import { PODCAST_PAGE_SLUG } from './routes'

// Smaller than the blog listing's pageSize (10, src/utils/main/tagFilter.ts):
// each episode embeds a live iframe, so a shorter page keeps iframe count
// per view down.
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
  const pages = await getCollection('podcast-pages')
  const localizedPage = findPodcastPage(pages, lang)
  const mdxPage = localizedPage ?? findPodcastPage(pages, defaultLocale)

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
