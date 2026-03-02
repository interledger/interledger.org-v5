/**
 * MDX Transformer
 *
 * Transforms MDX files into Strapi payload format for page content types
 * (foundation-pages, summit-pages). Each content type config in config.ts
 * provides its own buildPayload function that calls this for page types.
 *
 * Handles page content types by:
 * - Validating frontmatter against Zod schemas
 * - Parsing MDX body into blocks (<Paragraph>, <AmbassadorGrid>, <Blockquote>, plain text)
 * - Building Strapi dynamic zone content from parsed blocks
 */

import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { FrontmatterSchema } from './config'
import type { ParsedBlock } from './mdxComponentParser'
import { parseMdxComponents } from './mdxComponentParser'

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

/**
 * Builds a Strapi block from a parsed MDX block.
 */
async function buildStrapiBlock(
  block: ParsedBlock,
  strapi: StrapiClient
): Promise<Record<string, unknown>> {
  switch (block.type) {
    case 'paragraph':
      return {
        __component: 'blocks.paragraph',
        content: block.content
      }
    case 'ambassadors-grid': {
      const ambassadors = await strapi.findAmbassadorsBySlugs(block.slugs)
      const documentIds = ambassadors.map((a) => a.documentId)
      return {
        __component: 'blocks.ambassadors-grid',
        heading: block.heading || null,
        ambassadors:
          documentIds.length > 0 ? { connect: documentIds } : undefined
      }
    }
    case 'blockquote':
      return {
        __component: 'blocks.blockquote',
        quote: block.quote,
        source: block.source || null
      }
  }
}

/**
 * Builds a Strapi payload for a page-type MDX file.
 *
 * This function:
 * 1. Validates frontmatter against the provided Zod schema
 * 2. Builds the base payload with required fields (title, slug, publishedAt)
 * 3. Handles hero section (from frontmatter or preserves existing)
 * 4. Parses MDX body into blocks and builds Strapi dynamic zone content
 *
 * @param schema - Zod schema to validate/parse the frontmatter
 * @param mdx - MDX file data with frontmatter and content
 * @param existingEntry - Existing Strapi entry (optional, for updates)
 * @param strapi - Strapi client for resolving relations (e.g. ambassador slugs)
 * @returns Strapi payload object
 */
export async function buildPagePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null,
  strapi: StrapiClient
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

  // Handle content import: parse MDX blocks and build Strapi dynamic zone
  const mdxBody = (mdx.content || '').trim()
  if (mdxBody.length > 0) {
    const parsedBlocks = parseMdxComponents(mdx.content || '')
    const strapiBlocks: Record<string, unknown>[] = []
    for (const block of parsedBlocks) {
      const strapiBlock = await buildStrapiBlock(block, strapi)
      strapiBlocks.push(strapiBlock)
    }
    data.content = strapiBlocks
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
export function buildBlogPayload(
  schema: FrontmatterSchema,
  mdx: MDXFile
): Record<string, unknown> {
  const parsed = schema.parse({
    ...mdx.frontmatter,
    slug: mdx.slug
  }) as Record<string, unknown>

  const date = parsed.date as Date

  return {
    title: parsed.title,
    description: parsed.description,
    slug: parsed.slug,
    date: date.toISOString().split('T')[0],
    publishedAt: date.toISOString(),
    content: mdx.content || ''
  }
}
