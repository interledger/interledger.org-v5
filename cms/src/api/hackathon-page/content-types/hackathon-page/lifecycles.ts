import matter from 'gray-matter'
import { createPageLifecycle, PATHS } from '../../../utils'
import type { PageData } from '../../../../utils/pageLifecycle'
import {
  defaultLang,
  MATTER_STRINGIFY_OPTIONS,
  serializeContent
} from '../../../../utils'
import { HACKATHON_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

/**
 * Duplicates the default `generateMDX` in pageLifecycle.ts, which now
 * handles a missing hero and a bare `description` field too. Kept only
 * because it predates that support; safe to remove in favor of the default.
 */
function generateHackathonPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const locale = page.locale || defaultLang
  const isLocalized = locale !== defaultLang
  const { localizes, ...restPreserved } = preservedFields
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) || localizes

  const frontmatterData: Record<string, unknown> = {
    ...restPreserved,
    pathSlug: page.pathSlug,
    title: page.title,
    description: page.description,
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const content = serializeContent(page.content)

  return matter.stringify(
    content ? `\n${content}\n` : '',
    frontmatterData,
    MATTER_STRINGIFY_OPTIONS
  )
}

export default createPageLifecycle({
  contentTypeUid: 'api::hackathon-page.hackathon-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.hackathonPages}`,
  populate: {
    content: HACKATHON_PAGE_CONTENT_POPULATE
  },
  generateMDX: generateHackathonPageMDX
})
