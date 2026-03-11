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
import type { foundationBlogFrontmatterSchema } from '../../../src/schemas/content'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError } from './parserErrors'
import fs from 'fs/promises'
import path from 'path'
import { getProjectRoot } from '@/utils/paths'
import mime from 'mime-types'

interface StrapiUploadContext {
  strapi: StrapiClient
  STRAPI_URL: string
  STRAPI_TOKEN: string
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

async function uploadImageToStrapi(
  STRAPI_URL: string,
  STRAPI_TOKEN: string,
  { filePath, alt }: { filePath: string; alt: string | undefined }
): Promise<number | null> {
  if (!filePath) return null

  try {
    const rootDir = getProjectRoot()
    const fullPath = `${rootDir}/public${filePath}`

    const fileBuffer = await fs.readFile(fullPath)
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream'
    const formData = new FormData()
    const blob = new Blob([fileBuffer], { type: mimeType })

    formData.append('files', blob, path.basename(fullPath))
    formData.append(
      'fileInfo',
      JSON.stringify({ alternativeText: alt ?? null })
    )

    const res = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`
      },
      body: formData
    })

    if (!res.ok) {
      console.error(
        `Failed to upload image: ${filePath} (status ${res.status})`
      )
      return null
    }

    const data: Array<{ id: number }> = await res.json()
    return data[0]?.id || null
  } catch (err) {
    console.error(`Error uploading image "${filePath}: "`, err)
    return null
  }
}

// Returns existing Strapi image ID or uploads a new image
async function getImageFromStrapi(
  { strapi, STRAPI_URL, STRAPI_TOKEN }: StrapiUploadContext,
  { url, alt }: { url: string | undefined; alt: string | undefined }
): Promise<number | null> {
  const photoUrl = nullOrValue(url)
  if (!photoUrl) return null
  const name = path.basename(photoUrl)

  try {
    const existing = await strapi.findUploadByName(name)
    if (existing) {
      return existing
    }
    const uploaded = await uploadImageToStrapi(STRAPI_URL, STRAPI_TOKEN, {
      filePath: photoUrl,
      alt
    })
    return uploaded
  } catch (err) {
    console.error(`Error getting image from Strapi for "${url}":`, err)
    return null
  }
}

/**
 * Builds a Strapi payload for a page-type MDX file.
 *
 * This function:
 * 1. Validates frontmatter against the provided Zod schema
 * 2. Builds the base payload with required fields (title, slug, publishedAt)
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
  parserCtx?: ParserContext
): Promise<Record<string, unknown>> {
  // Validate frontmatter against schema (throws if invalid)
  const parsed = schema.parse({
    ...mdx.frontmatter,
    slug: mdx.slug
  }) as Record<string, unknown>

  // Build base payload with required fields
  const data: Record<string, unknown> = {
    title: parsed.title,
    slug: parsed.slug,
    publishedAt: new Date().toISOString()
  }

  // Handle hero section
  // If hero fields exist in frontmatter, use them
  // Otherwise, preserve existing hero data if updating an entry
  if (parsed.heroTitle || parsed.heroDescription) {
    data.hero = {
      title: parsed.heroTitle || parsed.title,
      description: parsed.heroDescription || ''
    }
  } else {
    const existingHero = getEntryField(existingEntry, 'hero')
    if (existingHero) {
      data.hero = existingHero
    }
  }

  // Handle content import
  const mdxBody = (mdx.content || '').trim()
  if (mdxBody.length > 0) {
    if (parserCtx) {
      // Parse MDX body into structured dynamic-zone blocks.
      // Parser errors (unsupported JSX, missing props, unresolved relations)
      // are intentional hard failures — re-thrown with file context.
      try {
        data.content = await parseMdxToBlocks(mdxBody, parserCtx)
      } catch (err) {
        if (err instanceof MdxParserError) {
          throw new MdxParserError({
            code: err.code,
            message: `[${mdx.slug}] ${err.message}`,
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
 * Builds a Strapi payload for an ambassador MDX file.
 *
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @param strapi - Strapi client for resolving photo upload IDs
 * @returns Strapi payload object
 */
export async function buildAmbassadorPayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient
): Promise<Record<string, unknown>> {
  schema.parse({ ...mdx.frontmatter, slug: mdx.slug })

  const photoUrl = nullOrValue(mdx.frontmatter.photo as string)
  const photoId = photoUrl ? await strapi.findUploadByUrl(photoUrl) : null
  if (photoUrl && !photoId) {
    console.warn(
      `   ⚠️  Photo not found in Strapi uploads for "${mdx.slug}": ${photoUrl}`
    )
  }

  return {
    name: nullOrValue(mdx.frontmatter.name),
    slug: mdx.slug,
    description: nullOrValue(mdx.frontmatter.description),
    ...(photoId ? { photo: photoId } : {}),
    linkedinUrl: nullOrValue(mdx.frontmatter.linkedinUrl),
    grantReportUrl: nullOrValue(mdx.frontmatter.grantReportUrl),
    publishedAt: new Date().toISOString()
  }
}

/**
 * Builds a Strapi payload for a blog-post-type MDX file.
 *
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @returns Strapi payload object
 */
export async function buildBlogPayload(
  schema: typeof foundationBlogFrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient
): Promise<Record<string, unknown>> {
  const STRAPI_URL = process.env.STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

  if (!STRAPI_URL || !STRAPI_TOKEN) {
    throw new Error(
      'STRAPI_URL and STRAPI_API_TOKEN must be set when syncing blog post images'
    )
  }
  const strapiUploadContext = { strapi, STRAPI_URL, STRAPI_TOKEN }

  let parsed
  try {
    parsed = schema.parse({
      ...mdx.frontmatter,
      slug: mdx.slug
    })
  } catch (err) {
    console.error('Error parsing Blog MDX frontmatter:', err)
    throw err
  }

  const date = new Date(parsed.date || Date.now())
  const featureImage = await getImageFromStrapi(strapiUploadContext, {
    url: parsed.featureImage,
    alt: parsed.featureImageAlt
  })
  const thumbnailImage = await getImageFromStrapi(strapiUploadContext, {
    url: parsed.thumbnailImage,
    alt: parsed.thumbnailImageAlt
  })

  const tags = (parsed.tags ?? []).map((tag) => ({ tagValue: tag }))

  const articleBio = await Promise.all(
    (parsed.articleBios ?? []).map(async (bio) => ({
      author: bio.author,
      profileBio: bio.text || null,
      profileImage:
        (await getImageFromStrapi(strapiUploadContext, {
          url: bio.image,
          alt: bio.author
        })) || null
    }))
  )

  const dataObj = {
    title: parsed.title,
    description: parsed.description,
    date: date.toISOString().split('T')[0],
    slug: parsed.slug,
    pillar: parsed.pillar,
    featureImage: featureImage,
    thumbnailImage: thumbnailImage,
    articleBio: articleBio,
    tags: tags,
    locale: parsed.locale,
    content: mdx.content || '',
    publishedAt: date.toISOString()
  }

  return dataObj
}
