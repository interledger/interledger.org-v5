import matter from 'gray-matter'
import { errors } from '@strapi/utils'
import type { Core } from '@strapi/strapi'
import {
  createPageLifecycle,
  shouldSkipMdxExport,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  seoFrontmatter,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE
} from '../../../../utils'

declare const strapi: Core.Strapi

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

async function assertUniqueGrantPathSlug(
  pathSlug: string,
  currentDocumentId: string | null
): Promise<void> {
  const overviewMatches = await strapi
    .documents('api::grant-overview-page.grant-overview-page')
    .findMany({ filters: { pathSlug: { $eq: pathSlug } } })
  const overviewConflict = (
    overviewMatches as Array<{ documentId: string }>
  ).filter((e) => e.documentId !== currentDocumentId)
  if (overviewConflict.length > 0) {
    throw new errors.ValidationError(
      `Path slug "${pathSlug}" is already used by another Grant Overview Page`
    )
  }

  const grantMatches = await strapi
    .documents('api::grant-page.grant-page')
    .findMany({ filters: { pathSlug: { $eq: pathSlug } } })
  if ((grantMatches as unknown[]).length > 0) {
    throw new errors.ValidationError(
      `Path slug "${pathSlug}" is already used by a Grant Page. Slugs must be unique across both collections.`
    )
  }
}

const lifecycle = createPageLifecycle({
  contentTypeUid: 'api::grant-overview-page.grant-overview-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.grantOverviewPages}`,
  populate: GRANT_OVERVIEW_PAGE_CONTENT_POPULATE as unknown as Parameters<
    typeof createPageLifecycle
  >[0]['populate'],
  generateMDX: generateGrantOverviewPageMDX
})

export default {
  ...lifecycle,
  async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    if (shouldSkipMdxExport()) return
    const pathSlug = event.params.data.pathSlug as string | undefined
    const documentId =
      (event.params.data.documentId as string | undefined) ?? null
    if (pathSlug) await assertUniqueGrantPathSlug(pathSlug, documentId)
  },
  async beforeUpdate(event: Parameters<typeof lifecycle.beforeUpdate>[0]) {
    if (!shouldSkipMdxExport()) {
      const pathSlug = event.params?.data?.pathSlug as string | undefined
      if (pathSlug) {
        const documentId =
          event.params?.documentId ?? event.params?.data?.documentId ?? null
        await assertUniqueGrantPathSlug(pathSlug, documentId)
      }
    }
    await lifecycle.beforeUpdate(event)
  }
}
