import matter from 'gray-matter'
import {
  createPageLifecycle,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  seoFrontmatter,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE
} from '../../../../utils'

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
  followUpContent?: string
  ctaStrip?: CtaStrip | null
}

function generateGrantOverviewPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const overviewPage = page as GrantOverviewPageData
  const locale = page.locale ?? 'en'
  const isLocalized = locale !== 'en'
  const { localizes: preservedLocalizes, ...restPreserved } = preservedFields
  // Fields owned by Strapi components must be explicitly deleted from
  // restPreserved so that removing them in Strapi clears them from the MDX
  // rather than leaving the old value behind.
  delete (restPreserved as Record<string, unknown>).metaDescription
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) ?? preservedLocalizes

  const ctaStrip = overviewPage.ctaStrip

  const frontmatter: Record<string, unknown> = {
    ...restPreserved,
    title: page.title,
    pathSlug: page.pathSlug,
    description: overviewPage.description ?? '',
    ...(ctaStrip
      ? {
          ctaStrip: {
            heading: ctaStrip.heading ?? '',
            description: ctaStrip.description ?? '',
            buttonText: ctaStrip.primaryButtonText ?? '',
            buttonLink: ctaStrip.primaryButtonLink ?? '',
            color: ctaStrip.color ?? 'purple',
            ...(ctaStrip.secondaryButtonText
              ? { secondaryButtonText: ctaStrip.secondaryButtonText }
              : {}),
            ...(ctaStrip.secondaryButtonLink
              ? { secondaryButtonLink: ctaStrip.secondaryButtonLink }
              : {})
          }
        }
      : {}),
    ...seoFrontmatter(page.seo as { metaDescription?: string } | undefined),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const body = overviewPage.followUpContent ?? ''

  return matter.stringify(
    body ? `\n${body}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}

export default createPageLifecycle({
  contentTypeUid: 'api::grant-overview-page.grant-overview-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.grantOverviewPages}`,
  populate: GRANT_OVERVIEW_PAGE_CONTENT_POPULATE as unknown as Parameters<
    typeof createPageLifecycle
  >[0]['populate'],
  generateMDX: generateGrantOverviewPageMDX
})
