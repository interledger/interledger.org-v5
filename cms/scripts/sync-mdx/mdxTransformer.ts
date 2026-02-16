/**
 * MDX Transformer
 * 
 * Transforms MDX files into Strapi payload format for content types.
 * Handles page content types (foundation-pages, summit-pages) by:
 * - Validating frontmatter against Zod schemas
 * - Converting MDX content to HTML
 * - Preserving existing Strapi entry data when appropriate
 */

import { marked } from 'marked'
import { type MDXFile } from './scan'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapiClient'
import {
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from '../../../src/schemas/content'

// Configure marked to not generate header IDs (Strapi handles this)
marked.use({ headerIds: false })

// Content types that are treated as "pages" (have hero sections, etc.)
const PAGE_TYPES = ['foundation-pages', 'summit-pages'] as const

/**
 * Extracts a field value from a Strapi entry.
 * 
 * Handles both flat entry structure and nested attributes structure
 * that Strapi may return depending on API response format.
 * 
 * @param entry - Strapi entry (may be null for new entries)
 * @param key - Field name to extract
 * @returns Field value or null if not found
 */
export function getEntryField(entry: StrapiEntry | null, key: string): unknown {
  if (!entry) return null
  return (
    entry[key] ??
    (entry as Record<string, unknown>).attributes?.[key as keyof typeof entry] ??
    null
  )
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
 * 4. Converts MDX content to HTML (or preserves existing if MDX is empty)
 * 
 * Currently only supports page content types (foundation-pages, summit-pages).
 * Returns null for unsupported content types.
 * 
 * @param contentType - Content type identifier (e.g., 'foundation-pages')
 * @param mdx - MDX file data with frontmatter and content
 * @param existingEntry - Existing Strapi entry (optional, for updates)
 * @returns Strapi payload object or null if content type not supported
 */
export function mdxToStrapiPayload(
  contentType: keyof ContentTypes,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null
): Record<string, unknown> | null {
  // Only process page content types
  if (isPageType(contentType)) {
    // Select the appropriate schema based on content type
    const schema = contentType === 'foundation-pages' 
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

    // Handle content conversion
    // Convert MDX to HTML if content exists, otherwise preserve existing content
    const mdxBody = (mdx.content || '').trim()
    if (mdxBody.length > 0) {
      // Wrap converted HTML in a Strapi paragraph block component
      data.content = [
        {
          __component: 'blocks.paragraph',
          content: marked.parse(mdx.content)
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

  // Return null for unsupported content types
  return null
}
