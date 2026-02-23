/**
 * MDX Transformer
 *
 * Transforms MDX files into Strapi payload format for content types.
 * Handles page content types (foundation-pages, summit-pages) by:
 * - Validating frontmatter against Zod schemas
 * - Importing MDX content as markdown (preserving original format)
 * - Preserving existing Strapi entry data when appropriate
 */

import { type MDXFile } from './scan'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapiClient'
import {
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'

// Content types that are treated as "pages" (have hero sections, etc.)
const PAGE_TYPES = ['foundation-pages', 'summit-pages'] as const

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
 * Checks if a content type is a "page" type.
 *
 * Page types have special handling for hero sections and content blocks.
 *
 * @param contentType - Content type to check
 * @returns true if content type is a page type
 */
export function isPageType(contentType: keyof ContentTypes): boolean {
  return PAGE_TYPES.includes(contentType as (typeof PAGE_TYPES)[number])
}

/**
 * Transforms an MDX file into a Strapi API payload.
 *
 * This function:
 * 1. Validates frontmatter against the appropriate Zod schema
 * 2. Builds the base payload with required fields (title, slug, publishedAt)
 * 3. Handles hero section (from frontmatter or preserves existing)
 * 4. Imports MDX content as markdown (preserves original format, no HTML conversion)
 *
 * Currently only supports page content types (foundation-pages, summit-pages).
 * Throws an error for unsupported content types.
 *
 * @param contentType - Content type identifier (e.g., 'foundation-pages')
 * @param mdx - MDX file data with frontmatter and content
 * @param existingEntry - Existing Strapi entry (optional, for updates)
 * @returns Strapi payload object
 * @throws Error if content type is not supported
 */
export function mdxToStrapiPayload(
  contentType: keyof ContentTypes,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null
): Record<string, unknown> {
  // Only process page content types
  if (isPageType(contentType)) {
    // Select the appropriate schema based on content type
    const schema =
      contentType === 'foundation-pages'
        ? foundationPageFrontmatterSchema
        : summitPageFrontmatterSchema

    // Validate frontmatter against schema (throws if invalid)
    const parsed = schema.parse({
      ...mdx.frontmatter,
      slug: mdx.slug
    })

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
    // Import MDX content as markdown (preserve original format, no HTML conversion)
    const mdxBody = (mdx.content || '').trim()
    if (mdxBody.length > 0) {
      // Store markdown content in a Strapi paragraph block component
      // Strapi's richtext field can accept markdown and will handle rendering
      data.content = [
        {
          __component: 'blocks.paragraph',
          content: mdx.content
        }
      ]
    } else {
      // Preserve existing content if MDX file has no body
      const existingContent = getEntryField(existingEntry, 'content')
      if (existingContent) {
        data.content = existingContent
      }
    }

    return data
  }

  // Throw error for unsupported content types
  throw new Error(`Unsupported content type: ${contentType}`)
}
