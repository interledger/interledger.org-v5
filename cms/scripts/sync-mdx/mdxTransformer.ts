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
 */

import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { FrontmatterSchema } from './config'
import type { foundationBlogFrontmatterSchema } from '@site/schemas/content'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError } from './parserErrors'
import { normalizeInlineImages } from './normalizeImages'
import type { HeroCta } from '@/utils'
import path from 'path'

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
async function getImageFromStrapi(
  { strapi, dryRun }: StrapiUploadContext,
  { image }: { image: string | undefined }
): Promise<number | null> {
  const photoUrl = nullOrValue(image)
  if (!photoUrl) return null

  const name = normalizeStrapiFilename(path.basename(photoUrl))

  try {
    const byUrl = await strapi.findUploadByUrl(photoUrl)
    if (byUrl) return byUrl

    const byName = await strapi.findUploadByName(name)
    if (byName) return byName

    const localHint = isLocalAssetPath(photoUrl)
      ? ' Start Strapi to run bootstrap seeding, or register this file in Media Library.'
      : ''
    const dryRunPrefix = dryRun ? '[DRY-RUN] ' : ''
    throw new Error(
      `${dryRunPrefix}Missing Strapi upload for image "${photoUrl}". Auto-upload is disabled to avoid duplicating local assets.${localHint}`
    )
  } catch (err) {
    console.error(
      `Error resolving image from Strapi for "${image}":`,
      err instanceof Error ? err.message : err
    )
    throw err
  }
}

interface StrapiHeroPayload {
  title: string
  description: string
  backgroundImage?: number | null
  hero_call_to_action?: Array<{
    text: string
    link: string
    style: string
    external: boolean
    analytics_event_label?: string
  }>
}

function buildHeroPayload(
  heroTitle: string | undefined,
  heroDescription: string | undefined,
  fallbackTitle: string,
  ctas: HeroCta[] | undefined
): StrapiHeroPayload {
  const hero: StrapiHeroPayload = {
    title: heroTitle || fallbackTitle,
    description: heroDescription || ''
  }

  const validCtas = ctas?.filter((c) => c.text && c.link)
  if (validCtas && validCtas.length > 0) {
    hero.hero_call_to_action = validCtas.map((c) => ({
      text: c.text!,
      link: c.link!,
      style: c.style ?? 'primary',
      external: c.external ?? false,
      ...(c.analytics_event_label
        ? { analytics_event_label: c.analytics_event_label }
        : {})
    }))
  }

  return hero
}

/**
 * Resolves hero from frontmatter (title, description, CTAs), preserves the
 * existing Strapi hero when those fields are omitted, and optionally syncs
 * heroImage / heroImageAlt to Strapi uploads (including alt patches).
 */
async function buildHeroWithImage(
  parsed: Record<string, unknown>,
  existingEntry: StrapiEntry | null,
  strapiUploadContext: StrapiUploadContext | undefined,
  updatedAltIds: Map<number, string | null>,
  pathSlug: string,
  dryRun: boolean
): Promise<Record<string, unknown> | undefined> {
  const existingHeroRaw = getEntryField(existingEntry, 'hero')
  const existingHero =
    existingHeroRaw && typeof existingHeroRaw === 'object'
      ? { ...(existingHeroRaw as Record<string, unknown>) }
      : null

  let heroPayload: Record<string, unknown> | undefined
  if (parsed.heroTitle || parsed.heroDescription) {
    heroPayload = buildHeroPayload(
      parsed.heroTitle as string | undefined,
      parsed.heroDescription as string | undefined,
      parsed.title as string,
      parsed.heroCtas as HeroCta[] | undefined
    ) as unknown as Record<string, unknown>
  } else if (existingHero) {
    heroPayload = existingHero
  }

  const hasHeroImageField = Object.prototype.hasOwnProperty.call(
    parsed,
    'heroImage'
  )
  if (hasHeroImageField && strapiUploadContext) {
    const heroImage = await getImageFromStrapi(strapiUploadContext, {
      image: parsed.heroImage as string | undefined,
      alt: parsed.heroImageAlt as string | null | undefined
    })
    if (!heroPayload) heroPayload = {}
    const hero = heroPayload as unknown as StrapiHeroPayload
    hero.backgroundImage = heroImage ?? null

    if (heroImage && parsed.heroImageAlt !== undefined) {
      await updateUploadAltOnce(
        strapiUploadContext.strapi,
        heroImage,
        nullOrValue(parsed.heroImageAlt),
        updatedAltIds,
        pathSlug,
        dryRun
      )
    }
  }

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
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @param existingEntry - Existing Strapi entry (optional, for updates)
 * @param parserCtx - When provided, MDX body is parsed into structured blocks
 *   via `parseMdxToBlocks`. Without it, the body is stored as a single paragraph.
 * @returns Strapi payload object
 */
export async function buildPagePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null,
  parserCtx?: ParserContext,
  strapiUploadContext?: StrapiUploadContext,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
): Promise<Record<string, unknown>> {
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

  const heroPayload = await buildHeroWithImage(
    parsed,
    existingEntry,
    strapiUploadContext,
    updatedAltIds,
    mdx.pathSlug,
    dryRun
  )

  if (heroPayload) {
    data.hero = heroPayload
  }

  // Handle content import
  const mdxBody = (mdx.content || '').trim()
  if (mdxBody.length > 0) {
    if (parserCtx) {
      // Parse MDX body into structured dynamic-zone blocks.
      // Parser errors (unsupported JSX, missing props, unresolved relations)
      // are intentional hard failures — re-thrown with file context.
      try {
        data.content = await parseMdxToBlocks(mdxBody, {
          ...parserCtx,
          sourceText: mdxBody
        })
      } catch (err) {
        if (err instanceof MdxParserError) {
          throw new MdxParserError({
            code: err.code,
            message: `[${mdx.pathSlug}] ${err.message}`,
            component: err.component,
            prop: err.prop,
            line: err.line,
            column: err.column
          })
        }
        throw err
      }
    } else {
      // Fallback: store entire body as a single paragraph block
      data.content = [
        {
          __component: 'blocks.paragraph',
          content: mdx.content
        }
      ]
    }
  } else {
    // Preserve existing content if MDX file has no body
    const existingContent = getEntryField(existingEntry, 'content')
    if (existingContent) {
      data.content = existingContent
    }
  }

  return data
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
      `   🏷️  [DRY-RUN] Would update alt text for upload #${id} from "${pathSlug}".`
    )
    updatedAltIds.set(id, alt)
    return
  }

  await strapi.updateUploadAlt(id, alt)
  updatedAltIds.set(id, alt)
}

/**
 * Builds a Strapi payload for an ambassador MDX file.
 *
 * Also patches the photo upload file's alternativeText when photoAlt is
 * present in frontmatter, so alt text survives re-exports.
 *
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @param strapi - Strapi client for resolving photo upload IDs
 * @param updatedAltIds - Upload IDs already patched in this sync run (shared-image guard)
 * @returns Strapi payload object
 */
export async function buildAmbassadorPayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient,
  updatedAltIds: Map<number, string | null> = new Map(),
  dryRun = false
): Promise<Record<string, unknown>> {
  schema.parse({ ...mdx.frontmatter, pathSlug: mdx.pathSlug })

  const photoUrl = nullOrValue(mdx.frontmatter.photo as string)
  const photoId = photoUrl ? await strapi.findUploadByUrl(photoUrl) : null
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

  return {
    name: nullOrValue(mdx.frontmatter.name),
    pathSlug: mdx.pathSlug,
    description: nullOrValue(mdx.content),
    ...(photoId ? { photo: photoId } : {}),
    category: nullOrValue(mdx.frontmatter.category),
    tagline: nullOrValue(mdx.frontmatter.tagline),
    quote: nullOrValue(mdx.frontmatter.quote),
    publishedAt: new Date().toISOString()
  }
}

/**
 * Builds a Strapi payload for a blog-post-type MDX file.
 *
 * - Normalizes inline <img> tags to markdown before sending to Strapi so
 *   CKEditor doesn't escape JSX attributes as literal text.
 * - Resolves featureImage / thumbnailImage URLs to Strapi upload IDs and
 *   patches their alternativeText when alt frontmatter fields are present.
 *
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @param strapi - Strapi client for media lookups and alt-text updates
 * @param updatedAltIds - Upload IDs already patched in this sync run (shared-image guard)
 * @returns Strapi payload object
 */
export async function buildBlogPayload(
  schema: typeof foundationBlogFrontmatterSchema,
  mdx: MDXFile,
  strapiUploadContext: StrapiUploadContext,
  updatedAltIds: Map<number, string | null> = new Map(),
  parserCtx?: ParserContext,
  dryRun = false
): Promise<Record<string, unknown>> {
  let parsed
  try {
    parsed = schema.parse({
      ...mdx.frontmatter,
      pathSlug: mdx.pathSlug
    })
  } catch (err) {
    console.error('Error parsing Blog MDX frontmatter:', err)
    throw err
  }

  const date = new Date(parsed.date || Date.now())
  const featureImage = await getImageFromStrapi(strapiUploadContext, {
    image: parsed.featureImage
  })
  const thumbnailImage = await getImageFromStrapi(strapiUploadContext, {
    image: parsed.thumbnailImage
  })

  const tags = (parsed.tags ?? []).map((tag) => ({ tagValue: tag }))

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

  // Parse MDX body into structured blocks when parser context is provided.
  // Falls back to normalized markdown string for backwards compatibility.
  const mdxBody = (mdx.content || '').trim()
  let content: unknown
  if (parserCtx && mdxBody.length > 0) {
    try {
      content = await parseMdxToBlocks(mdxBody, {
        ...parserCtx,
        sourceText: mdxBody
      })
    } catch (err) {
      if (err instanceof MdxParserError) {
        throw new MdxParserError({
          code: err.code,
          message: `[${mdx.pathSlug}] ${err.message}`,
          component: err.component,
          prop: err.prop,
          line: err.line,
          column: err.column
        })
      }
      throw err
    }
  } else {
    content = normalizeInlineImages(mdxBody)
  }

  return {
    title: parsed.title,
    description: parsed.description,
    pathSlug: parsed.pathSlug,
    date: date.toISOString().split('T')[0],
    pillar: parsed.pillar,
    featureImage,
    thumbnailImage,
    articleBio,
    tags,
    locale: parsed.locale,
    content,
    publishedAt: date.toISOString()
  }
}
