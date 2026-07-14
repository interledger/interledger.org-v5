import matter from 'gray-matter'
import { errors } from '@strapi/utils'
import type { Core } from '@strapi/strapi'
import {
  createPageLifecycle,
  shouldSkipMdxExport,
  type PageData,
  PATHS,
  MATTER_STRINGIFY_OPTIONS,
  heroFrontmatter,
  validateHeroFields,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE,
  validateContentBlocks
} from '../../../../utils'
import { serializeContent } from '../../../../serializers/blocks'

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
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  followUpContent?: string
  hero?: Record<string, unknown> | null
  ctaStrip?: CtaStrip | null
}

export function generateGrantOverviewPageMDX(
  page: PageData,
  preservedFields: Record<string, unknown>,
  englishSlug?: string
): string {
  const overviewPage = page as GrantOverviewPageData
  const locale = page.locale ?? 'en'
  const isLocalized = locale !== 'en'
  const { localizes: preservedLocalizes, ...restPreserved } = preservedFields
  // Clear hero fields — removing the hero in Strapi must also clear them from MDX.
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

  const ctaStrip = overviewPage.ctaStrip
  const hero = overviewPage.hero as Parameters<typeof heroFrontmatter>[0]

  const frontmatter: Record<string, unknown> = {
    ...restPreserved,
    title: page.title,
    pathSlug: page.pathSlug,
    description: overviewPage.description ?? '',
    ...heroFrontmatter(hero),
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
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const parts: string[] = []
  if (overviewPage.followUpContent?.trim())
    parts.push(overviewPage.followUpContent.trim())
  const blocks = serializeContent(overviewPage.content ?? undefined)
  if (blocks) parts.push(blocks)
  const body = parts.join('\n\n')

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

function validateGrantOverviewPage(data: Record<string, unknown>): void {
  const page = data as GrantOverviewPageData
  const validationError =
    validateHeroFields(page) ?? validateContentBlocks(page.content ?? undefined)
  if (validationError) throw validationError
}

export default {
  ...lifecycle,
  async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    validateGrantOverviewPage(event.params.data)
    if (shouldSkipMdxExport()) return
    const pathSlug = event.params.data.pathSlug as string | undefined
    const documentId =
      (event.params.data.documentId as string | undefined) ?? null
    if (pathSlug) await assertUniqueGrantPathSlug(pathSlug, documentId)
  },
  async beforeUpdate(event: Parameters<typeof lifecycle.beforeUpdate>[0]) {
    if (event.params?.data) validateGrantOverviewPage(event.params.data)
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
