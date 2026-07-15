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
  faqFrontmatterSchema
} from '@site/schemas/content'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { normalizeInlineImages } from './normalizeImages'
import type { HeroCta } from '@/utils'
import { tryCatchAsync, getProjectRoot } from '@/utils'
import path from 'path'
import fs from 'fs'

export interface StrapiUploadContext {
  strapi: StrapiClient
  STRAPI_URL: string
  STRAPI_TOKEN: string
  dryRun: boolean
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

interface StrapiHeroPayload {
  title: string
  description: string
  backgroundImage?: number | null
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
  updatedAltIds: Map<number, string | null>,
  pathSlug: string,
  dryRun: boolean
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

  let heroPayload: Record<string, unknown> | null = heroFieldsPresent
    ? (buildHeroPayload(
        parsed.heroTitle as string | undefined,
        parsed.heroDescription as string | undefined,
        parsed.heroCtas as HeroCta[] | undefined
      ) as unknown as Record<string, unknown>)
    : null

  async function resolveHeroImage(
    imageKey: 'heroImage' | 'heroImageMobile',
    altKey: 'heroImageAlt' | 'heroImageMobileAlt',
    targetKey: 'backgroundImage' | 'backgroundImageMobile'
  ): Promise<void> {
    if (!hasField(imageKey) || !strapiUploadContext) return

    const uploadId = await getImageFromStrapi(strapiUploadContext, {
      image: parsed[imageKey] as string | undefined
    })
    if (!heroPayload) heroPayload = {}
    const hero = heroPayload as unknown as StrapiHeroPayload
    hero[targetKey] = uploadId ?? null

    if (uploadId && parsed[altKey] !== undefined) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        uploadId,
        nullOrValue(parsed[altKey]),
        updatedAltIds,
        pathSlug,
        dryRun
      )
    }
  }

  await resolveHeroImage('heroImage', 'heroImageAlt', 'backgroundImage')
  await resolveHeroImage(
    'heroImageMobile',
    'heroImageMobileAlt',
    'backgroundImageMobile'
  )

  return heroPayload
}

/**
 * Builds a Strapi payload for a page-type MDX file.
 *
 * This function:
 * 1. Validates frontmatter against the provided Zod schema
 * 2. Builds the base payload with required fields (title, pathSlug, publishedAt)
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
  strapiUploadContext?: StrapiUploadContext,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
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
      publishedAt: new Date().toISOString(),
      ...(parsed.pillar ? { pillar: parsed.pillar } : {})
    }

    data.hero = await buildHeroWithImage(
      parsed,
      strapiUploadContext,
      updatedAltIds,
      mdx.pathSlug,
      dryRun
    )

    // Handle content import
    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)
    if (content !== undefined) {
      data.content = content
    }

    return data
  })
}

async function buildContentFromMdxBody(
  mdx: MDXFile,
  existingEntry: StrapiEntry | null,
  parserCtx?: ParserContext
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

interface ProfileCtaFrontmatter {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

/** Normalize the frontmatter CTA into a Strapi component payload, or null. */
function ctaPayload(value: unknown): ProfileCtaFrontmatter | null {
  if (!value || typeof value !== 'object') return null
  const cta = value as ProfileCtaFrontmatter
  if (!cta.text || !cta.link) return null
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
 * Also patches the photo upload file's alternativeText when photoAlt is
 * present in frontmatter, so alt text survives re-exports, and maps the
 * optional `cta` frontmatter object to the `shared.cta-link` component.
 *
 * Returns `Record<string, unknown> | Error`.
 */
export async function buildProfilePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
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

    if (photoId) {
      const photoAltFrontmatter = mdx.frontmatter.photoAlt as
        | string
        | null
        | undefined
      if (photoAltFrontmatter !== undefined) {
        await updateUploadAltOnce(
          strapi,
          photoId,
          nullOrValue(photoAltFrontmatter),
          updatedAltIds,
          mdx.pathSlug,
          dryRun
        )
      }
    }

    const cta = ctaPayload(mdx.frontmatter.cta)
    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)

    return {
      name: nullOrValue(mdx.frontmatter.name),
      pathSlug: mdx.pathSlug,
      ...(mdx.frontmatter.section ? { section: mdx.frontmatter.section } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(photoId ? { photo: photoId } : {}),
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
 * show up in Strapi's dynamic zone. `programOverview` is a legacy plain-text
 * mirror of the body kept only for entries that predate the block parser;
 * once a page is parsed into blocks it stays cleared.
 */
export async function buildGrantPagePayload(
  schema: typeof grantPageFrontmatterSchema,
  mdx: MDXFile,
  strapi?: StrapiClient,
  existingEntry: StrapiEntry | null = null,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
): Promise<Record<string, unknown> | Error> {
  return tryCatchAsync(async () => {
    const parsed = schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

    const primaryCta = parsed.primaryCta
      ? {
          text: parsed.primaryCta.text,
          link: parsed.primaryCta.link,
          external: parsed.primaryCta.external ?? false
        }
      : null

    const ctaStripFm = parsed.ctaStrip
    const ctaStrip = {
      heading: ctaStripFm.heading,
      description: ctaStripFm.description,
      primaryButtonText: ctaStripFm.buttonText,
      primaryButtonLink: ctaStripFm.buttonLink,
      color: ctaStripFm.color,
      ...(ctaStripFm.secondaryButtonText
        ? { secondaryButtonText: ctaStripFm.secondaryButtonText }
        : {}),
      ...(ctaStripFm.secondaryButtonLink
        ? { secondaryButtonLink: ctaStripFm.secondaryButtonLink }
        : {})
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
    const faqSection = faqSectionFm
      ? {
          title: faqSectionFm.title,
          subtitle: faqSectionFm.subtitle,
          description: faqSectionFm.description,
          ctaText: faqSectionFm.ctaText,
          ctaLink: faqSectionFm.ctaLink,
          items: (faqSectionFm.items ?? []).map(
            (i: { question: string; answer: string }) => ({
              question: i.question,
              answer: i.answer
            })
          )
        }
      : null

    const parserCtx: ParserContext | undefined = strapi
      ? {
          locale: mdx.locale || 'en',
          resolveMediaUpload: async (url: string) => {
            const id = await strapi.findUploadByUrl(url)
            if (id instanceof Error) throw id
            if (!id) {
              throw new MdxParserError({
                code: ParserErrorCode.UNRESOLVED_RELATION,
                message: `Upload "${url}" could not be resolved to a Strapi file ID.`
              })
            }
            return id
          },
          updateMediaAlt: async (id: number, alt: string | null) => {
            await updateUploadAltOnce(
              strapi,
              id,
              alt,
              updatedAltIds,
              mdx.pathSlug,
              dryRun
            )
          }
        }
      : undefined

    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      programOverview: null,
      primaryCta,
      faqSection,
      ctaStrip,
      infoCards,
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
 * zone. `followUpContent` is a legacy plain-text mirror of the body kept only
 * for entries that predate the block parser; once a page is parsed into
 * blocks it stays cleared.
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
    const ctaStrip = {
      heading: ctaStripFm.heading,
      description: ctaStripFm.description,
      primaryButtonText: ctaStripFm.buttonText,
      primaryButtonLink: ctaStripFm.buttonLink,
      color: ctaStripFm.color,
      ...(ctaStripFm.secondaryButtonText
        ? { secondaryButtonText: ctaStripFm.secondaryButtonText }
        : {}),
      ...(ctaStripFm.secondaryButtonLink
        ? { secondaryButtonLink: ctaStripFm.secondaryButtonLink }
        : {})
    }

    const hero = await buildHeroWithImage(
      mdx.frontmatter as Record<string, unknown>,
      strapiUploadContext,
      updatedAltIds,
      mdx.pathSlug,
      dryRun
    )

    const strapi = strapiUploadContext?.strapi
    const parserCtx: ParserContext | undefined = strapi
      ? {
          locale: mdx.locale || 'en',
          resolveMediaUpload: async (url: string) => {
            const id = await strapi.findUploadByUrl(url)
            if (id instanceof Error) throw id
            if (!id) {
              throw new MdxParserError({
                code: ParserErrorCode.UNRESOLVED_RELATION,
                message: `Upload "${url}" could not be resolved to a Strapi file ID.`
              })
            }
            return id
          },
          updateMediaAlt: async (id: number, alt: string | null) => {
            await updateUploadAltOnce(
              strapi,
              id,
              alt,
              updatedAltIds,
              mdx.pathSlug,
              dryRun
            )
          }
        }
      : undefined

    const content = await buildContentFromMdxBody(mdx, existingEntry, parserCtx)

    return {
      title: parsed.title,
      pathSlug: parsed.pathSlug,
      description: parsed.description,
      hero,
      ctaStrip,
      followUpContent: null,
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
  updatedAltIds: Map<number, string | null> = new Map(),
  parserCtx?: ParserContext,
  dryRun = false
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

        if (profileImageId && bio.imageAlt !== undefined) {
          await updateUploadAltOnce(
            strapiUploadContext.strapi,
            profileImageId,
            nullOrValue(bio.imageAlt),
            updatedAltIds,
            mdx.pathSlug,
            dryRun
          )
        }

        return {
          author: bio.author,
          link: bio.link || null,
          profileBio: bio.text || null,
          profileImage: profileImageId
        }
      })
    )

    // getImageFromStrapi only sets alt text on newly uploaded files.
    // For existing files (found by name), patch alt text explicitly.
    if (featureImage && parsed.featureImageAlt !== undefined) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        featureImage,
        nullOrValue(parsed.featureImageAlt),
        updatedAltIds,
        mdx.pathSlug,
        dryRun
      )
    }
    if (featureImageMobile && parsed.featureImageMobileAlt !== undefined) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        featureImageMobile,
        nullOrValue(parsed.featureImageMobileAlt),
        updatedAltIds,
        mdx.pathSlug,
        dryRun
      )
    }
    if (thumbnailImage && parsed.thumbnailImageAlt !== undefined) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        thumbnailImage,
        nullOrValue(parsed.thumbnailImageAlt),
        updatedAltIds,
        mdx.pathSlug,
        dryRun
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
      featureImage,
      featureImageMobile,
      thumbnailImage,
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
