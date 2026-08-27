import matter from 'gray-matter'
import {
  createPageLifecycle,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  heroFrontmatter,
  ckeditorFieldToParsedMarkdown,
  GRANT_PAGE_CONTENT_POPULATE
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
  ctaExternal?: boolean
  ctaDocument?: boolean
  items?: FaqItem[]
}

interface GrantPageData extends PageData {
  description?: string
  programOverview?: string
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  primaryCta?: CtaLink | null
  infoCards?: InfoCards | null
  faqSection?: FaqSection | null
  ctaStrip?: CtaStrip | null
}

export function generateGrantPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const grantPage = page as GrantPageData
  const locale = page.locale ?? 'en'
  const isLocalized = locale !== 'en'
  const { localizes: preservedLocalizes, ...restPreserved } = preservedFields

  delete (restPreserved as Record<string, unknown>).primaryCta
  delete (restPreserved as Record<string, unknown>).infoCards
  delete (restPreserved as Record<string, unknown>).faqSection
  delete (restPreserved as Record<string, unknown>).ctaStrip
  delete (restPreserved as Record<string, unknown>).programOverview
  for (const key of [
    'heroTitle',
    'heroDescription',
    'heroImage',
    'heroImageAlt',
    'heroImageMobile',
    'heroImageMobileAlt',
    'heroCtas'
  ])
    delete (restPreserved as Record<string, unknown>)[key]
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
    ...heroFrontmatter(grantPage.hero),
    ...(grantPage.programOverview
      ? {
          programOverview: ckeditorFieldToParsedMarkdown(
            grantPage.programOverview
          )
        }
      : {}),
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
    ...(infoCards
      ? {
          infoCards: {
            ...(infoCards.heading ? { heading: infoCards.heading } : {}),
            cards: [
              {
                heading: infoCards.card1?.heading ?? '',
                body: infoCards.card1?.body
                  ? ckeditorFieldToParsedMarkdown(infoCards.card1.body)
                  : ''
              },
              {
                heading: infoCards.card2?.heading ?? '',
                body: infoCards.card2?.body
                  ? ckeditorFieldToParsedMarkdown(infoCards.card2.body)
                  : ''
              },
              {
                heading: infoCards.card3?.heading ?? '',
                body: infoCards.card3?.body
                  ? ckeditorFieldToParsedMarkdown(infoCards.card3.body)
                  : ''
              }
            ]
          }
        }
      : {}),
    ...(faqSection
      ? {
          faqSection: {
            title: faqSection.title ?? '',
            description: faqSection.description ?? '',
            ...(faqSection.subtitle?.trim()
              ? { subtitle: faqSection.subtitle.trim() }
              : {}),
            // Both halves or neither, matching the serializer and renderer.
            // Compare and write the trimmed values: `validateGrantPageFaqSection`
            // and the renderer both treat whitespace as empty, so a truthiness
            // test would export `"   "` into MDX and then drop it on render.
            //
            // The flags sit inside the same guard: a dropped button must not
            // leave a document flag behind in the frontmatter.
            ...(faqSection.ctaText?.trim() && faqSection.ctaLink?.trim()
              ? {
                  ctaText: faqSection.ctaText.trim(),
                  ctaLink: faqSection.ctaLink.trim(),
                  ...(faqSection.ctaExternal ? { ctaExternal: true } : {}),
                  ...(faqSection.ctaDocument ? { ctaDocument: true } : {})
                }
              : {}),
            items: (faqSection.items ?? []).map((i) => ({
              question: i.question ?? '',
              answer: i.answer ? ckeditorFieldToParsedMarkdown(i.answer) : ''
            }))
          }
        }
      : {}),
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
              : {})
          }
        }
      : {}),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const body = serializeContent(grantPage.content ?? undefined)

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
