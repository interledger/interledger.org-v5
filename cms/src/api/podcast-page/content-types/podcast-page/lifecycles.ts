/**
 * Lifecycle callbacks for the podcast-page content type.
 *
 * podcast-page is a flat, frontmatter-only page (no `content` dynamic zone —
 * title cards and podcast episodes are page-owned repeatable components,
 * flattened straight into frontmatter). Only one entry is expected to exist,
 * routed at /podcast via its pathSlug.
 */

import {
  PATHS,
  createPageLifecycle,
  generatePodcastPageMdx,
  PODCAST_PAGE_CONTENT_POPULATE,
  type PageData
} from '../../../../utils'
import type {
  PodcastPageTitleCardGrid,
  PodcastPageItem,
  PodcastPageCtaStrip
} from '../../../../utils/podcastPageMdx'

interface PodcastPageData extends PageData {
  description?: string
  hero?: Record<string, unknown> | null
  titleCards?: PodcastPageTitleCardGrid
  podcasts?: PodcastPageItem[]
  ctaStrip?: PodcastPageCtaStrip
}

function generatePodcastPageMDX(
  page: PageData,
  _preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const podcastPage = page as PodcastPageData

  return generatePodcastPageMdx(
    {
      title: podcastPage.title,
      pathSlug: podcastPage.pathSlug ?? '',
      description: podcastPage.description ?? '',
      hero: podcastPage.hero,
      titleCards: podcastPage.titleCards ?? {
        columns: 'Three',
        ariaLabel: '',
        titleCards: []
      },
      podcasts: podcastPage.podcasts ?? [],
      ctaStrip: podcastPage.ctaStrip ?? {},
      locale: podcastPage.locale
    },
    englishSlug
  )
}

export default createPageLifecycle({
  contentTypeUid: 'api::podcast-page.podcast-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.podcastPages}`,
  populate: PODCAST_PAGE_CONTENT_POPULATE as unknown as Parameters<
    typeof createPageLifecycle
  >[0]['populate'],
  generateMDX: generatePodcastPageMDX
})
