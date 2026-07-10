import matter from 'gray-matter'
import {
  createPageLifecycle,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  GRANT_PAGE_CONTENT_POPULATE,
  validateGrantPagePrimaryCta,
  validateGrantInfoCards,
  validateGrantPageFaqSection
} from '../../../../utils'
import { serializeContent } from '../../../../serializers/blocks'

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
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color?: string
}

interface InfoCard {
  heading?: string
  body?: string
}

interface InfoCards {
  heading?: string
  card1?: InfoCard
  card2?: InfoCard
  card3?: InfoCard
}

interface FaqItem {
  question?: string
  answer?: string
}

interface FaqSection {
  title?: string
  subtitle?: string
  description?: string
  ctaText?: string
  ctaLink?: string
  items?: FaqItem[]
}

interface GrantPageData extends PageData {
  description?: string
  programOverview?: string
  primaryCta?: CtaLink | null
  faqSection?: FaqSection | null
  ctaStrip?: CtaStrip | null
  infoCards?: InfoCards | null
  content?: Array<{ __component: string; [key: string]: unknown }>
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
  // Fields owned by Strapi components must be explicitly deleted from
  // restPreserved so that removing them in Strapi clears them from the MDX
  // rather than leaving the old value behind.
  delete (restPreserved as Record<string, unknown>).primaryCta
  delete (restPreserved as Record<string, unknown>).infoCards
  delete (restPreserved as Record<string, unknown>).faqSection
  delete (restPreserved as Record<string, unknown>).programOverview
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) ?? preservedLocalizes

  const ctaStrip = grantPage.ctaStrip
  const primaryCta = grantPage.primaryCta
  const infoCards = grantPage.infoCards
  const faqSection = grantPage.faqSection

  const frontmatter: Record<string, unknown> = {
    ...restPreserved,
    title: page.title,
    pathSlug: page.pathSlug,
    description: grantPage.description ?? '',
    ...(primaryCta
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
    ...(grantPage.programOverview
      ? { programOverview: grantPage.programOverview }
      : {}),
    ...(faqSection
      ? {
          faqSection: {
            title: faqSection.title ?? '',
            subtitle: faqSection.subtitle ?? '',
            description: faqSection.description ?? '',
            ctaText: faqSection.ctaText ?? '',
            ctaLink: faqSection.ctaLink ?? '',
            items: (faqSection.items ?? []).map((i) => ({
              question: i.question ?? '',
              answer: i.answer ?? ''
            }))
          }
        }
      : {}),
    ...(ctaStrip
      ? {
          ctaStrip: {
            heading: ctaStrip.heading,
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
    ...(infoCards
      ? {
          infoCards: {
            ...(infoCards.heading ? { heading: infoCards.heading } : {}),
            cards: [
              {
                heading: infoCards.card1?.heading ?? '',
                body: infoCards.card1?.body ?? ''
              },
              {
                heading: infoCards.card2?.heading ?? '',
                body: infoCards.card2?.body ?? ''
              },
              {
                heading: infoCards.card3?.heading ?? '',
                body: infoCards.card3?.body ?? ''
              }
            ]
          }
        }
      : {}),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const body = serializeContent(grantPage.content)

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
  generateMDX: generateGrantPageMDX,
  validate: (page) =>
    validateGrantPagePrimaryCta(page) ??
    validateGrantInfoCards(page) ??
    validateGrantPageFaqSection(page)
})
