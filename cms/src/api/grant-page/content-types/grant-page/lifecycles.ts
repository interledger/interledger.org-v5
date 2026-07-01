import matter from 'gray-matter'
import {
  createPageLifecycle,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  seoFrontmatter,
  GRANT_PAGE_CONTENT_POPULATE
} from '../../../../utils'

interface CtaLink {
  text?: string
  link?: string
  external?: boolean
}

interface CtaStrip {
  heading?: string
  description?: string
  primaryButtonText?: string
  primaryButtonLink?: string
}

interface GrantPageData extends PageData {
  description?: string
  programOverview?: string
  primaryCta?: CtaLink | null
  ctaStrip?: CtaStrip | null
}

function generateGrantPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const grantPage = page as GrantPageData
  const locale = page.locale ?? 'en'
  const isLocalized = locale !== 'en'
  const { localizes: preservedLocalizes, ...restPreserved } = preservedFields
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) ?? preservedLocalizes

  const ctaStrip = grantPage.ctaStrip
  const primaryCta = grantPage.primaryCta

  const frontmatter: Record<string, unknown> = {
    ...restPreserved,
    title: page.title,
    pathSlug: page.pathSlug,
    description: grantPage.description ?? '',
    ...(primaryCta?.text && primaryCta?.link
      ? {
          primaryCta: {
            text: primaryCta.text,
            link: primaryCta.link,
            ...(primaryCta.external != null
              ? { external: primaryCta.external }
              : {})
          }
        }
      : {}),
    ...(ctaStrip
      ? {
          ctaStrip: {
            heading: ctaStrip.heading,
            description: ctaStrip.description ?? '',
            buttonText: ctaStrip.primaryButtonText ?? '',
            buttonLink: ctaStrip.primaryButtonLink ?? ''
          }
        }
      : {}),
    ...seoFrontmatter(page.seo as { metaDescription?: string } | undefined),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const body = grantPage.programOverview ?? ''

  return matter.stringify(
    body ? `\n${body}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}

export default createPageLifecycle({
  contentTypeUid: 'api::grant-page.grant-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.grantPages}`,
  populate: GRANT_PAGE_CONTENT_POPULATE as unknown as Parameters<
    typeof createPageLifecycle
  >[0]['populate'],
  generateMDX: generateGrantPageMDX
})
