/**
 * MDX Transformer
 *
 * Transforms MDX files into Strapi payload format for page content types
 * (foundation-pages, summit-pages). Each content type config in config.ts
 * provides its own buildPayload function that calls this for page types.
 *
 * Handles page content types by:
 * - Validating frontmatter against Zod schemas
 * - Importing MDX content as markdown (preserving original format)
 * - Preserving existing Strapi entry data when appropriate
 *
 * Errors-as-values: each builder wraps its body in `tryCatchAsync` and
 * returns `Record<string, unknown> | Error`. Internal helpers throw freely;
 * the outer wrap normalizes the return.
 */

import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { FrontmatterSchema } from './config'
import type {
  foundationBlogFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  faqFrontmatterSchema,
  reportFrontmatterSchema,
  hackathonPageFrontmatterSchema,
  podcastPageFrontmatterSchema
} from '@site/schemas/content'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import type { ParsedBlock } from './types.blocks'
import { createRelationResolver } from './profileHandler'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { normalizeInlineImages } from './normalizeImages'
import type { HeroCta } from '@/utils'
import { tryCatchAsync, getProjectRoot, validateLocalImageUrl } from '@/utils'
import {
  formatCardGridVariantList,
  getAllowedCardGridVariants,
  isCardGridVariantAllowed
} from '../../src/utils/cardGrid'
import path from 'path'
import fs from 'fs'

/**
 * Reject CardGrid blocks whose variant is not allowed on this content type
 * (grant page → Info only, grant overview → Title only).
 */
function assertCardGridVariantsAllowed(
  content: unknown,
  contentTypeUid: string
): void {
  const allowed = getAllowedCardGridVariants(contentTypeUid)
  if (!Array.isArray(content)) return
  const label = formatCardGridVariantList(allowed)
  for (const [index, block] of content.entries()) {
    if (
      !block ||
      typeof block !== 'object' ||
      (block as { __component?: string }).__component !== 'blocks.card-grid'
    ) {
      continue
    }
    const variant = (block as { variant?: unknown }).variant
    if (typeof variant !== 'string') continue
    if (!isCardGridVariantAllowed(variant, contentTypeUid)) {
      throw new Error(
        `Card grid at content[${index}] uses variant "${variant}", but this content type only allows ${label}.`
      )
    }
  }
}

export interface StrapiUploadContext {
  strapi: StrapiClient
  STRAPI_URL: string
  STRAPI_TOKEN: string
  dryRun: boolean
  /**
   * `locale:pathSlug` keys for profile-pages in this run's MDX source, for
   * createRelationResolver's dry-run fallback (see profileHandler.ts).
   */
  profilePathSlugs?: Set<string>
}

/**
 * Extracts a field value from a Strapi entry.
 *
 * @param entry - Strapi entry (may be null for new entries)
 * @param key - Field name to extract
 * @returns Field value or null if not found
 */
export function getEntryField(entry: StrapiEntry | null, key: string): unknown {
  if (!entry) return null
  const entryRecord = entry as Record<string, unknown>
  return entryRecord[key] ?? null
}

function normalizeStrapiFilename(filename: string) {
  // Strapi adds hash to media name: name_<10 hex chars>.ext
  // and replaces `-` and spaces with `_` when generating image url
  return filename
    .replace(/_[a-f0-9]{10}(?=\.)/i, '') // remove hash
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^\w_.]/g, '')
}

function isLocalAssetPath(url: string): boolean {
  return url.startsWith('/img/') || url.startsWith('/uploads/')
}

// Returns an existing Strapi upload ID for a referenced image.
// Local assets must already exist in Strapi media records; this function never uploads.
// Throws on resolution failure so the surrounding tryCatchAsync wrap converts
// the throw into a returned Error at the builder boundary.
async function getImageFromStrapi(
  { strapi, dryRun }: StrapiUploadContext,
  { image }: { image: string | undefined }
): Promise<number | null> {
  const photoUrl = nullOrValue(image)
  if (!photoUrl) return null

  const sizeError = validateLocalImageUrl(getProjectRoot(), photoUrl)
  if (sizeError) throw sizeError

  const name = normalizeStrapiFilename(path.basename(photoUrl))

  const byUrl = await strapi.findUploadByUrl(photoUrl)
  if (byUrl instanceof Error) throw byUrl
  if (byUrl) return byUrl

  const byName = await strapi.findUploadByName(name)
  if (byName instanceof Error) throw byName
  if (byName) return byName

  if (
    dryRun &&
    isLocalAssetPath(photoUrl) &&
    fs.existsSync(path.join(getProjectRoot(), 'public', photoUrl))
  ) {
    console.log(
      `   ⚠️  [DRY-RUN] Image not yet in Strapi: "${photoUrl}" (will be seeded on next Strapi start)`
    )
    return null
  }

  const localHint = isLocalAssetPath(photoUrl)
    ? ' Start Strapi to run bootstrap seeding, or register this file in Media Library.'
    : ''
  const dryRunPrefix = dryRun ? '[DRY-RUN] ' : ''
  throw new Error(
    `${dryRunPrefix}Missing Strapi upload for image "${photoUrl}". Auto-upload is disabled to avoid duplicating local assets.${localHint}`
  )
}

/**
 * Builds a `resolveMediaUpload` resolver for the MDX block parser (ImageBlock,
 * PdfEmbed, carousels, etc). In dry-run mode, a media path that doesn't
 * resolve yet but already exists on disk under `public/` is tolerated —
 * bootstrap seeding (`seedUploadsFromDisk`) will register it the next time
 * Strapi starts from this branch's code — rather than treated as a broken
 * reference.
 */
export function createMediaUploadResolver(
  strapi: StrapiClient,
  dryRun: boolean
): (url: string) => Promise<number | null> {
  return async (url: string): Promise<number | null> => {
    const sizeError = validateLocalImageUrl(getProjectRoot(), url)
    if (sizeError) throw sizeError

    const id = await strapi.findUploadByUrl(url)
    if (id instanceof Error) throw id
    if (id) return id

    if (
      dryRun &&
      isLocalAssetPath(url) &&
      fs.existsSync(path.join(getProjectRoot(), 'public', url))
    ) {
      console.log(
        `   ⚠️  [DRY-RUN] Upload not yet in Strapi: "${url}" (will be seeded on next Strapi start)`
      )
      return null
    }

    throw new MdxParserError({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      message: `Upload "${url}" could not be resolved to a Strapi file ID.`
    })
  }
}

interface StrapiHeroPayload {
  title: string
  description: string
  media?: { image: number | null; alternativeText: string | null } | null
  backgroundImageMobile?: number | null
  hero_call_to_action?: {
    text: string
    link: string
    style: string
    external: boolean
  } | null
}

function buildHeroPayload(
  heroTitle: string | undefined,
  heroDescription: string | undefined,
  ctas: HeroCta[] | undefined
): StrapiHeroPayload {
  const hero: StrapiHeroPayload = {
    title: heroTitle ?? '',
    description: heroDescription ?? ''
  }

  const cta = ctas?.[0]
  if (cta) {
    hero.hero_call_to_action = {
      text: cta.text ?? '',
      link: cta.link ?? '',
      style: cta.style ?? 'primary',
      external: cta.external ?? false
    }
  }

  return hero
}

/**
 * Resolves hero from frontmatter (title, description, CTAs)
 * Returns `null` when the frontmatter has no hero fields at all — the MDX
 * file is the source of truth, so a hero removed from Astro gets cleared in Strapi too.
 */
async function buildHeroWithImage(
  parsed: Record<string, unknown>,
  strapiUploadContext: StrapiUploadContext | undefined,
  altContext?: {
    pathSlug: string
    updatedAltIds: Map<number, string | null>
  }
): Promise<Record<string, unknown> | null> {
  const hasField = (key: string) =>
    Object.prototype.hasOwnProperty.call(parsed, key)
  const hasHeroImageField = hasField('heroImage')
  const hasHeroImageMobileField = hasField('heroImageMobile')
  const heroFieldsPresent =
    hasField('heroTitle') ||
    hasField('heroDescription') ||
    hasField('heroCtas') ||
    hasHeroImageField ||
    hasHeroImageMobileField

  const trimmedHeroTitle = (parsed.heroTitle as string | undefined)?.trim()

  let heroPayload: Record<string, unknown> | null = heroFieldsPresent
    ? (buildHeroPayload(
        trimmedHeroTitle || (parsed.title as string | undefined),
        parsed.heroDescription as string | undefined,
        parsed.heroCtas as HeroCta[] | undefined
      ) as unknown as Record<string, unknown>)
    : null

  async function resolveHeroImage(
    imageKey: 'heroImage' | 'heroImageMobile',
    targetKey: 'media' | 'backgroundImageMobile'
  ): Promise<void> {
    if (!hasField(imageKey) || !strapiUploadContext) return

    const uploadId = await getImageFromStrapi(strapiUploadContext, {
      image: parsed[imageKey] as string | undefined
    })
    if (!heroPayload) heroPayload = {}
    const hero = heroPayload as unknown as StrapiHeroPayload
    if (targetKey === 'media') {
      hero.media = uploadId
        ? {
            image: uploadId,
            alternativeText: optionalAltText(parsed.heroImageAlt)
          }
        : null
    } else {
      // Plain media field: alt lives on the upload file, not the component.
      hero[targetKey] = uploadId ?? null
      if (
        uploadId != null &&
        altContext &&
        Object.prototype.hasOwnProperty.call(parsed, 'heroImageMobileAlt')
      ) {
        await updateUploadAltOnce(
          strapiUploadContext.strapi,
          uploadId,
          nullOrValue(parsed.heroImageMobileAlt),
          altContext.updatedAltIds,
          altContext.pathSlug,
          strapiUploadContext.dryRun ?? false
        )
      }
    }
  }

  await resolveHeroImage('heroImage', 'media')
  await resolveHeroImage('heroImageMobile', 'backgroundImageMobile')

  return heroPayload
}

/**
 * Builds a Strapi payload for a page-type MDX file.
 *
 * This function:
 * 1. Validates frontmatter against the provided Zod schema
 * 2. Builds the base payload with required fields (title, pathSlug, description, publishedAt)
 * 3. Handles hero section (from frontmatter or preserves existing)
 * 4. Imports MDX content as markdown (preserves original format, no HTML conversion)
 *
 * Returns `Record<string, unknown> | Error`. Internal failures (Zod parse,
 * missing Strapi upload, parser failure) are caught at the boundary by
 * `tryCatchAsync` and returned to the caller.
 */
export async function buildPagePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext,
  strapiUploadContext?: StrapiUploadContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    // Validate frontmatter against schema (throws if invalid)
    const parsed = schema.parse({
      ...mdx.frontmatter,
      pathSlug: mdx.pathSlug
    }) as Record<string, unknown>

    // Build base payload with required fields
    const data: Record<string, unknown> = {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      publishedAt: new Date().toISOString()
    }

    data.hero = await buildHeroWithImage(
      parsed,
      strapiUploadContext,
      strapiUploadContext
        ? {
            pathSlug: mdx.pathSlug,
            updatedAltIds: new Map<number, string | null>()
          }
        : undefined
    )

    // Handle content import
    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)
    if (content !== undefined) {
      data.content = content
    }

    return data
  })
}

/**
 * Ensures every parsed block's `__component` is in `allowedComponents`. Used
 * by content types with a restricted dynamic zone (e.g. hackathon-pages)
 * so an MDX author using an out-of-scope component (one that has a globally
 * registered parser handler, but isn't allowed for this content type) fails
 * the sync loudly instead of either silently succeeding or relying on
 * Strapi's own dynamic-zone rejection at write time.
 */
function assertAllowedComponents(
  blocks: ParsedBlock[],
  allowedComponents: readonly string[],
  pathSlug: string
): void {
  const disallowed = blocks.find(
    (block) => !allowedComponents.includes(block.__component)
  )
  if (disallowed) {
    throw new Error(
      `[${pathSlug}] Component "${disallowed.__component}" is not allowed here. Allowed components: ${allowedComponents.join(', ')}.`
    )
  }
}

async function buildContentFromMdxBody(
  mdx: MDXFile,
  existingEntry: StrapiEntry | null,
  parserCtx?: ParserContext,
  allowedComponents?: readonly string[]
): Promise<unknown> {
  const mdxBody = (mdx.content || '').trim()
  if (mdxBody.length > 0) {
    if (parserCtx) {
      const parsedBlocks = await parseMdxToBlocks(mdxBody, {
        ...parserCtx,
        sourceText: mdxBody
      })
      if (parsedBlocks instanceof MdxParserError) {
        throw new MdxParserError({
          code: parsedBlocks.code,
          message: `[${mdx.pathSlug}] ${parsedBlocks.message}`,
          component: parsedBlocks.component,
          prop: parsedBlocks.prop,
          line: parsedBlocks.line,
          column: parsedBlocks.column
        })
      }
      if (allowedComponents) {
        assertAllowedComponents(parsedBlocks, allowedComponents, mdx.pathSlug)
      }
      return parsedBlocks
    }

    return [
      {
        __component: 'blocks.paragraph',
        content: mdx.content
      }
    ]
  }

  const existingContent = getEntryField(existingEntry, 'content')
  if (existingContent) {
    return existingContent
  }

  return undefined
}

/** Coerce YAML null / "null" / empty-string values to null. */
function nullOrValue(v: unknown): string | null {
  if (v === 'null' || v == null || v === '') return null
  return String(v)
}

/**
 * Alt text for localized-media: absent/null/"null" → null so consumers can
 * fall back (e.g. profile.name, upload alternativeText). Explicit `''` is kept
 * for decorative images.
 */
function optionalAltText(v: unknown): string | null {
  if (v === undefined || v === null || v === 'null') return null
  return String(v)
}

/**
 * Calls updateUploadAlt only if this upload ID hasn't been patched yet in
 * the current sync run. Prevents last-write-wins corruption when the same
 * image file is referenced by multiple entries with different alt values.
 *
 * Throws on Strapi API failure so the surrounding builder's tryCatchAsync
 * wrap converts the throw into a returned Error at the boundary.
 */
async function updateUploadAltOnce(
  strapi: StrapiClient,
  id: number,
  alt: string | null,
  updatedAltIds: Map<number, string | null>,
  pathSlug: string,
  dryRun: boolean
): Promise<void> {
  const existing = updatedAltIds.get(id)
  if (existing !== undefined) {
    if (existing !== alt) {
      console.warn(
        `   ⚠️  Alt text conflict for upload #${id} in "${pathSlug}" — already set to "${existing}" by another entry this run. Update alt text via Strapi Media Library instead.`
      )
    }
    return
  }

  if (dryRun) {
    console.log(
      `   🏷️  [DRY-RUN] Would update alt text for upload #${id} to "${alt ?? 'null'}" (entry: "${pathSlug}").`
    )
    updatedAltIds.set(id, alt)
    return
  }

  const result = await strapi.updateUploadAlt(id, alt)
  if (result instanceof Error) throw result
  updatedAltIds.set(id, alt)
}

/**
 * Builds an `updateMediaAlt` callback for the MDX block parser (plain media
 * fields that still store alt on the upload, e.g. featureImageMobile).
 * Share one `updatedAltIds` map across content types so conflicting names get
 * warned about rather than last-write-wins.
 */
export function createMediaAltUpdater(
  strapi: StrapiClient,
  updatedAltIds: Map<number, string | null>,
  pathSlug: string,
  dryRun: boolean
): (id: number, alt: string | null) => Promise<void> {
  return async (id: number, alt: string | null) => {
    await updateUploadAltOnce(strapi, id, alt, updatedAltIds, pathSlug, dryRun)
  }
}

interface ProfileCtaFrontmatter {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

/**
 * Normalize the frontmatter CTA into a Strapi component payload, or null.
 * Throws if `cta` is present but missing `text`/`link`. Absent `cta` is fine.
 */
function ctaPayload(
  value: unknown,
  pathSlug: string
): ProfileCtaFrontmatter | null {
  if (!value || typeof value !== 'object') return null
  const cta = value as ProfileCtaFrontmatter
  if (!cta.text || !cta.link) {
    throw new Error(
      `[${pathSlug}] Profile "cta" is missing required "text" and/or "link" — both are required when a cta is provided.`
    )
  }
  return {
    text: cta.text,
    link: cta.link,
    style: cta.style === 'secondary' ? 'secondary' : 'primary',
    external: cta.external === true
  }
}

/**
 * Builds a Strapi payload for a profile-page MDX file.
 *
 * Maps the `photo`/`photoAlt` frontmatter pair to the `media` shared.localized-media
 * component, and the optional `cta` frontmatter object to the `shared.cta-link`
 * component.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildProfilePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const photoUrl = nullOrValue(mdx.frontmatter.photo as string)
    let photoId: number | null = null
    if (photoUrl) {
      const result = await strapi.findUploadByUrl(photoUrl)
      if (result instanceof Error) throw result
      photoId = result
    }
    if (photoUrl && !photoId) {
      console.warn(
        `   ⚠️  Photo not found in Strapi uploads for "${mdx.pathSlug}": ${photoUrl}`
      )
    }

    const photoAltFrontmatter = mdx.frontmatter.photoAlt as
      | string
      | null
      | undefined
    const media = photoId
      ? {
          image: photoId,
          alternativeText: optionalAltText(photoAltFrontmatter)
        }
      : null

    const cta = ctaPayload(mdx.frontmatter.cta, mdx.pathSlug)
    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)

    return {
      name: nullOrValue(mdx.frontmatter.name),
      pathSlug: mdx.pathSlug,
      ...(mdx.frontmatter.section ? { section: mdx.frontmatter.section } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(media ? { media } : {}),
      category: nullOrValue(mdx.frontmatter.category),
      tagline: nullOrValue(mdx.frontmatter.tagline),
      description: nullOrValue(mdx.frontmatter.description as string),
      role: nullOrValue(mdx.frontmatter.role),
      cta,
      publishedAt: new Date().toISOString()
    }
  })
}

/**
 * Builds a Strapi payload for a grant-page MDX file.
 *
 * Maps frontmatter fields to the grant-page Strapi schema. The MDX body is
 * parsed into `content` dynamic-zone blocks (blocks.paragraph,
 * blocks.split-layout, etc.) via the same JSX block parser used for
 * foundation/summit pages — this is what lets `<SplitLayout>` and friends
 * show up in Strapi's dynamic zone. `programOverview` is its own dedicated
 * frontmatter field (rendered as the page's "Program Overview" section,
 * separate from the body dynamic zone), so it's synced straight from
 * frontmatter rather than derived from parsed body content.
 */
export async function buildGrantPagePayload(
  schema: typeof grantPageFrontmatterSchema,
  mdx: MDXFile,
  strapiUploadContext?: StrapiUploadContext,
  existingEntry: StrapiEntry | null = null,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })
    const strapi = strapiUploadContext?.strapi

    const primaryCta = parsed.primaryCta
      ? {
          text: parsed.primaryCta.text,
          link: parsed.primaryCta.link,
          external: parsed.primaryCta.external ?? false
        }
      : null

    const ctaStripFm = parsed.ctaStrip
    // Send null for absent/empty optional fields so PUT clears Strapi rather
    // than leaving a previously synced heading/description in place.
    const ctaStrip = {
      primaryButtonText: ctaStripFm.buttonText,
      primaryButtonLink: ctaStripFm.buttonLink,
      heading: nullOrValue(ctaStripFm.heading),
      description: nullOrValue(ctaStripFm.description),
      // null rather than omitted so a PUT clears a secondary button that was
      // removed from MDX, instead of leaving the previously synced one.
      secondaryButtonText: nullOrValue(ctaStripFm.secondaryButtonText),
      secondaryButtonLink: nullOrValue(ctaStripFm.secondaryButtonLink)
    }

    const infoCards = parsed.infoCards
      ? {
          ...(parsed.infoCards.heading
            ? { heading: parsed.infoCards.heading }
            : {}),
          card1: parsed.infoCards.cards[0],
          card2: parsed.infoCards.cards[1],
          card3: parsed.infoCards.cards[2]
        }
      : null

    const faqSectionFm = parsed.faqSection
    // subtitle/ctaText/ctaLink sent as null (not omitted) when absent so PUT
    // clears any previously synced values, matching the ctaStrip pattern above.
    const faqSection = faqSectionFm
      ? {
          title: faqSectionFm.title,
          subtitle: nullOrValue(faqSectionFm.subtitle),
          description: faqSectionFm.description,
          ctaText: nullOrValue(faqSectionFm.ctaText),
          ctaLink: nullOrValue(faqSectionFm.ctaLink),
          items: (faqSectionFm.items ?? []).map(
            (i: { question: string; answer: string }) => ({
              question: i.question,
              answer: i.answer
            })
          )
        }
      : null

    const hero = await buildHeroWithImage(
      mdx.frontmatter as Record<string, unknown>,
      strapiUploadContext,
      {
        pathSlug: mdx.pathSlug,
        updatedAltIds
      }
    )

    const parserCtx: ParserContext | undefined = strapi
      ? {
          locale: mdx.locale || 'en',
          resolveRelation: createRelationResolver(
            strapi,
            mdx.locale || 'en',
            dryRun,
            strapiUploadContext?.profilePathSlugs
          ),
          resolveMediaUpload: createMediaUploadResolver(strapi, dryRun),
          updateMediaAlt: createMediaAltUpdater(
            strapi,
            updatedAltIds,
            mdx.pathSlug,
            dryRun
          )
        }
      : undefined

    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)
    assertCardGridVariantsAllowed(content, 'api::grant-page.grant-page')

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      hero,
      programOverview: parsed.programOverview || null,
      primaryCta,
      infoCards,
      faqSection,
      ctaStrip,
      ...(content !== undefined ? { content } : {}),
      publishedAt: new Date().toISOString()
    }
  })
}

/**
 * Builds a Strapi payload for a grant-overview-page MDX file.
 *
 * Maps frontmatter fields to the grant-overview-page Strapi schema. Resolves
 * hero image URLs to Strapi upload IDs when present. The MDX body is parsed
 * into `content` dynamic-zone blocks (blocks.paragraph, blocks.split-layout,
 * blocks.carousel, etc.) via the same JSX block parser used for grant-page —
 * this is what lets `<SplitLayout>` and friends show up in Strapi's dynamic
 * zone. `followUpContent` is markdown stored in frontmatter and rendered
 * below the CTA strip on the site.
 */
export async function buildGrantOverviewPagePayload(
  schema: typeof grantOverviewPageFrontmatterSchema,
  mdx: MDXFile,
  strapiUploadContext?: StrapiUploadContext,
  existingEntry: StrapiEntry | null = null,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const ctaStripFm = parsed.ctaStrip
    // Send null for absent/empty optional fields so PUT clears Strapi rather
    // than leaving a previously synced heading/description in place.
    const ctaStrip = {
      primaryButtonText: ctaStripFm.buttonText,
      primaryButtonLink: ctaStripFm.buttonLink,
      heading: nullOrValue(ctaStripFm.heading),
      description: nullOrValue(ctaStripFm.description),
      // null rather than omitted so a PUT clears a secondary button that was
      // removed from MDX, instead of leaving the previously synced one.
      secondaryButtonText: nullOrValue(ctaStripFm.secondaryButtonText),
      secondaryButtonLink: nullOrValue(ctaStripFm.secondaryButtonLink)
    }

    const hero = await buildHeroWithImage(
      mdx.frontmatter as Record<string, unknown>,
      strapiUploadContext,
      {
        pathSlug: mdx.pathSlug,
        updatedAltIds
      }
    )

    const strapi = strapiUploadContext?.strapi
    const parserCtx: ParserContext | undefined = strapi
      ? {
          locale: mdx.locale || 'en',
          resolveRelation: createRelationResolver(
            strapi,
            mdx.locale || 'en',
            dryRun,
            strapiUploadContext?.profilePathSlugs
          ),
          resolveMediaUpload: createMediaUploadResolver(strapi, dryRun),
          updateMediaAlt: createMediaAltUpdater(
            strapi,
            updatedAltIds,
            mdx.pathSlug,
            dryRun
          )
        }
      : undefined

    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)
    assertCardGridVariantsAllowed(
      content,
      'api::grant-overview-page.grant-overview-page'
    )

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      hero,
      ctaStrip,
      followUpContent: parsed.followUpContent?.trim() || null,
      ...(content !== undefined ? { content } : {}),
      publishedAt: new Date().toISOString()
    }
  })
}

/**
 * Builds a Strapi payload for a faq-type MDX file.
 *
 * FAQ pages are flat frontmatter (title, pathSlug, section, heading,
 * description, introParagraph) plus a `content` dynamic zone parsed from the
 * MDX body — no media or relation resolution needed.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildFaqPayload(
  schema: typeof faqFrontmatterSchema,
  mdx: MDXFile
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      section: parsed.section,
      heading: parsed.heading,
      description: parsed.description,
      introParagraph: nullOrValue(parsed.introParagraph),
      faqSections: parsed.faqSections,
      publishedAt: new Date().toISOString()
    }
  })
}

/**
 * Builds a Strapi payload for the podcast-page MDX file.
 *
 * podcast-page has no `content` dynamic zone — hero, titleCards, podcasts,
 * and ctaStrip are all page-owned components flattened straight into
 * frontmatter, so this only needs frontmatter validation and hero image
 * resolution (shared with grant-overview-page via `buildHeroWithImage`).
 * No relation resolution.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildPodcastPagePayload(
  schema: typeof podcastPageFrontmatterSchema,
  mdx: MDXFile,
  strapiUploadContext?: StrapiUploadContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const hero = await buildHeroWithImage(
      mdx.frontmatter as Record<string, unknown>,
      strapiUploadContext,
      strapiUploadContext
        ? {
            pathSlug: mdx.pathSlug,
            updatedAltIds: new Map<number, string | null>()
          }
        : undefined
    )

    const titleCards = {
      columns: parsed.titleCards.columns,
      ariaLabel: parsed.titleCards.ariaLabel,
      titleCards: parsed.titleCards.cards
    }

    const podcasts = parsed.podcasts.map((podcast) => ({
      title: podcast.title,
      description: podcast.description,
      url: podcast.url,
      series: podcast.series
    }))

    const ctaStripFm = parsed.ctaStrip
    // Strips are purple only, so there is no `color` here. #481 took it out
    // after it made Strapi reject every podcast sync.
    //
    // #481 dropped the secondary CTA at the same time, which was right then:
    // the component had no secondary. INTORG-908 puts one back, so this reads
    // it again. All or nothing, whitespace counts as empty, matching the
    // handler, the serializer, the renderer and the validator.
    const podcastSecondaryText = ctaStripFm.secondaryButtonText?.trim()
    const podcastSecondaryLink = ctaStripFm.secondaryButtonLink?.trim()
    const ctaStrip = {
      heading: ctaStripFm.heading,
      description: ctaStripFm.description,
      primaryButtonText: ctaStripFm.buttonText,
      primaryButtonLink: ctaStripFm.buttonLink,
      ...(podcastSecondaryText && podcastSecondaryLink
        ? {
            secondaryButtonText: podcastSecondaryText,
            secondaryButtonLink: podcastSecondaryLink
          }
        : {})
    }

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      hero,
      titleCards,
      podcasts,
      ctaStrip,
      publishedAt: new Date().toISOString()
    }
  })
}

/** Normalize the frontmatter `date` object into a Strapi component payload, or null. */
function reportDatePayload(
  value: unknown
): { publishDate: string; lastUpdated?: string } | null {
  if (!value || typeof value !== 'object') return null
  const date = value as { publishDate?: unknown; lastUpdated?: unknown }
  if (!date.publishDate) return null
  return {
    publishDate: new Date(date.publishDate as string)
      .toISOString()
      .split('T')[0]!,
    ...(date.lastUpdated
      ? {
          lastUpdated: new Date(date.lastUpdated as string)
            .toISOString()
            .split('T')[0]
        }
      : {})
  }
}

/**
 * Builds a Strapi payload for a report MDX file.
 *
 * Maps frontmatter fields and MDX body to the report Strapi schema. No
 * media or relation resolution needed — reports have no managed media
 * fields, and the content zone only allows blocks.paragraph, which never
 * references either. `date` is sent as `null` when absent so a date removed
 * in Astro clears in Strapi too, rather than surviving as a stale field.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildReportPayload(
  schema: typeof reportFrontmatterSchema,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      section: parsed.section,
      heading: parsed.heading,
      description: parsed.description,
      introParagraph: nullOrValue(parsed.introParagraph),
      date: reportDatePayload(parsed.date),
      ...(content !== undefined ? { content } : {}),
      publishedAt: new Date().toISOString()
    }
  })
}

/** Dynamic-zone components allowed in hackathon-pages MDX/Strapi content. */
export const HACKATHON_PAGE_ALLOWED_COMPONENTS = [
  'blocks.paragraph',
  'blocks.card-grid',
  'blocks.number-tiles',
  'blocks.agenda',
  'blocks.split-layout',
  'blocks.profile-grid',
  'blocks.cta-strip',
  'blocks.carousel',
  'blocks.faq',
  'blocks.event-card',
  'blocks.quote'
] as const

/**
 * Builds a Strapi payload for a hackathon-page MDX file.
 *
 * Like reports, hackathon-pages have no hero/seo components — `description`
 * is a plain top-level field. Unlike every other page type's `content` zone,
 * the allowed component list is enforced here (not just at Strapi's own
 * dynamic-zone level): an MDX author using a component with a globally
 * registered handler but not in `HACKATHON_PAGE_ALLOWED_COMPONENTS` fails the
 * sync instead of relying solely on Strapi's write-time rejection.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildHackathonPagePayload(
  schema: typeof hackathonPageFrontmatterSchema,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const content = await buildContentFromMdxBody(
      mdx,
      existingEntry,
      parserCtx,
      HACKATHON_PAGE_ALLOWED_COMPONENTS
    )

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      ...(content !== undefined ? { content } : {}),
      publishedAt: new Date().toISOString()
    }
  })
}

/**
 * Builds a Strapi payload for a blog-post-type MDX file.
 *
 * - Normalizes inline <img> tags to markdown before sending to Strapi so
 *   CKEditor doesn't escape JSX attributes as literal text.
 * - Resolves featureImage / thumbnailImage URLs to Strapi upload IDs and
 *   patches their alternativeText when alt frontmatter fields are present.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildBlogPayload(
  schema: typeof foundationBlogFrontmatterSchema,
  mdx: MDXFile,
  strapiUploadContext: StrapiUploadContext,
  parserCtx?: ParserContext
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({
      ...mdx.frontmatter,
      pathSlug: mdx.pathSlug
    })

    const date = new Date(parsed.date || Date.now())
    const featureImage = await getImageFromStrapi(strapiUploadContext, {
      image: parsed.featureImage
    })
    const featureImageMobile = await getImageFromStrapi(strapiUploadContext, {
      image: parsed.featureImageMobile
    })
    const thumbnailImage = await getImageFromStrapi(strapiUploadContext, {
      image: parsed.thumbnailImage
    })
    const featureMedia = featureImage
      ? {
          image: featureImage,
          alternativeText: optionalAltText(parsed.featureImageAlt)
        }
      : null
    const thumbnailMedia = thumbnailImage
      ? {
          image: thumbnailImage,
          alternativeText: optionalAltText(parsed.thumbnailImageAlt)
        }
      : null

    const categories = (parsed.categories ?? []).map((category) => ({
      categoryValue: category
    }))

    const relatedArticles = (parsed.relatedArticles ?? []).map((slug) => ({
      slug
    }))

    const articleBio = await Promise.all(
      (parsed.articleBios ?? []).map(async (bio) => {
        const profileImageId =
          (await getImageFromStrapi(strapiUploadContext, {
            image: bio.image
          })) || null

        return {
          author: bio.author,
          link: bio.link || null,
          profileBio: bio.text || null,
          media: profileImageId
            ? {
                image: profileImageId,
                alternativeText: optionalAltText(bio.imageAlt)
              }
            : null
        }
      })
    )

    // featureImage/thumbnailImage alt lives on featureMedia/thumbnailMedia
    // (shared.localized-media). featureImageMobile is a plain media field —
    // its alt is the upload file's alternativeText, patched from
    // featureImageMobileAlt when present so mobile can differ from desktop.
    if (
      featureImageMobile != null &&
      parsed.featureImageMobileAlt !== undefined
    ) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        featureImageMobile,
        nullOrValue(parsed.featureImageMobileAlt),
        new Map<number, string | null>(),
        mdx.pathSlug,
        strapiUploadContext.dryRun ?? false
      )
    }

    // content is a Strapi dynamiczone (always an array), so an empty body
    // must become `[]`, not `''` — otherwise Strapi rejects the type.
    const mdxBody = (mdx.content || '').trim()
    let content: unknown
    if (mdxBody.length === 0) {
      content = []
    } else if (parserCtx) {
      const parsedBlocks = await parseMdxToBlocks(mdxBody, {
        ...parserCtx,
        sourceText: mdxBody
      })
      if (parsedBlocks instanceof MdxParserError) {
        throw new MdxParserError({
          code: parsedBlocks.code,
          message: `[${mdx.pathSlug}] ${parsedBlocks.message}`,
          component: parsedBlocks.component,
          prop: parsedBlocks.prop,
          line: parsedBlocks.line,
          column: parsedBlocks.column
        })
      }
      content = parsedBlocks
    } else {
      content = normalizeInlineImages(mdxBody)
    }

    return {
      title: parsed.title,
      description: parsed.description,
      pathSlug: parsed.pathSlug,
      date: date.toISOString().split('T')[0],
      ...(parsed.lastUpdated
        ? {
            lastUpdated: new Date(parsed.lastUpdated)
              .toISOString()
              .split('T')[0]
          }
        : {}),
      featured: parsed.featured ?? false,
      ...(featureMedia ? { featureMedia } : {}),
      featureImageMobile,
      // thumbnailMedia is optional in the schema, so null is sent as-is to clear it —
      // unlike featureMedia above, which is required and would be rejected as null.
      thumbnailMedia,
      articleBio,
      categories,
      relatedArticles,
      legacy: parsed.legacy ?? false,
      locale: parsed.locale,
      content,
      publishedAt: date.toISOString()
    }
  })
}
