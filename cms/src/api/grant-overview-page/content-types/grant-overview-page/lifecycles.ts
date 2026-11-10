import matter from 'gray-matter'
import {
  createPageLifecycle,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  heroFrontmatter,
  draftFrontmatter,
  ckeditorFieldToParsedMarkdown,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE,
  ctaStripColorMdxFields
} from '../../../../utils'
import { serializeContent } from '../../../../serializers/blocks'

interface CtaStrip {
  heading?: string
  description?: string
  primaryButtonText?: string
  primaryButtonLink?: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color?: string
}

interface GrantOverviewPageData extends PageData {
  description?: string
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  followUpContent?: string
  hero?: Record<string, unknown> | null
  ctaStrip?: CtaStrip | null
}

export async function generateGrantOverviewPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): Promise<string> {
  const overviewPage = page as GrantOverviewPageData
  const locale = page.locale ?? 'en'
  const isLocalized = locale !== 'en'
  const { localizes: preservedLocalizes, ...restPreserved } = preservedFields
  // Clear Strapi-managed fields — removing the hero or unchecking draft in
  // Strapi must also clear them from MDX.
  for (const key of [
    'draft',
    'heroTitle',
    'heroDescription',
    'heroImage',
    'heroImageAlt',
    'heroImageBlur',
    'heroImageMobile',
    'heroImageMobileAlt',
    'heroImageMobileBlur',
    'heroCtas',
    'followUpContent'
  ])
    delete (restPreserved as Record<string, unknown>)[key]
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) ?? preservedLocalizes

  const ctaStrip = overviewPage.ctaStrip
  const heroData = await heroFrontmatter(overviewPage.hero)
  const frontmatter: Record<string, unknown> = {
    ...restPreserved,
    title: page.title,
    pathSlug: page.pathSlug,
    ...draftFrontmatter(page.draft),
    description: overviewPage.description ?? '',
    ...heroData,
    ...(ctaStrip
      ? {
          ctaStrip: {
            buttonText: ctaStrip.primaryButtonText ?? '',
            buttonLink: ctaStrip.primaryButtonLink ?? '',
            ...(ctaStrip.heading ? { heading: ctaStrip.heading } : {}),
            ...(ctaStrip.description
              ? {
                  description: ckeditorFieldToParsedMarkdown(
                    ctaStrip.description
                  )
                }
              : {}),
            // Both halves or neither, matching the serializer and renderer.
            // Compare and write the trimmed values: `validateCtaStrip` and the
            // renderer both treat whitespace as empty, so a truthiness test
            // would export `"   "` into MDX and then drop it on render
            // (Copilot, #484).
            ...(ctaStrip.secondaryButtonText?.trim() &&
            ctaStrip.secondaryButtonLink?.trim()
              ? {
                  secondaryButtonText: ctaStrip.secondaryButtonText.trim(),
                  secondaryButtonLink: ctaStrip.secondaryButtonLink.trim()
                }
              : {}),
            ...ctaStripColorMdxFields(ctaStrip.color)
          }
        }
      : {}),
    ...(overviewPage.followUpContent?.trim()
      ? {
          followUpContent: ckeditorFieldToParsedMarkdown(
            overviewPage.followUpContent
          )
        }
      : {}),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const parts: string[] = []
  // A malformed stored block (e.g. one missing a required field) must not
  // block MDX generation for the rest of the entry — log and skip content
  // rather than failing the whole save.
  try {
    const blocks = serializeContent(overviewPage.content ?? undefined)
    if (blocks) parts.push(blocks)
  } catch (error) {
    console.error(
      `⚠️  Failed to serialize content blocks for grant-overview-page "${page.pathSlug}": ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const body = parts.join('\n\n')

  return matter.stringify(
    body ? `\n${body}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}

const lifecycle = createPageLifecycle({
  contentTypeUid: 'api::grant-overview-page.grant-overview-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.grantOverviewPages}`,
  populate: GRANT_OVERVIEW_PAGE_CONTENT_POPULATE as unknown as Parameters<
    typeof createPageLifecycle
  >[0]['populate'],
  generateMDX: generateGrantOverviewPageMDX
})

export default lifecycle
