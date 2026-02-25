import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./siteSchemas', async () => {
  const { z } = await import('zod')
  const sectionSchema = z.object({
    title: z.string(),
    content: z.string(),
    ctas: z
      .array(
        z.object({
          label: z.string(),
          href: z.string()
        })
      )
      .optional()
  })
  const pageSchema = z.object({
    title: z.string().min(1, 'title is required'),
    slug: z.string().min(1, 'slug is required'),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    sections: z.array(sectionSchema).optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  return {
    foundationPageFrontmatterSchema: pageSchema,
    summitPageFrontmatterSchema: pageSchema
  }
})

import { getEntryField, buildPagePayload } from './mdxTransformer'
import { foundationPageFrontmatterSchema, summitPageFrontmatterSchema } from './siteSchemas'
import type { StrapiEntry } from './strapiClient'
import { createMdxFile } from './test-utils'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Safe field accessor for Strapi entries. Returns null instead of throwing
// when accessing fields on null entries (common for new/create operations).
describe('getEntryField', () => {
  it('returns null when entry is null', () => {
    expect(getEntryField(null, 'title')).toBeNull()
  })

  it('returns field value when field exists on entry', () => {
    const entry: StrapiEntry = {
      documentId: '1',
      slug: 'test',
      title: 'My Title'
    }

    expect(getEntryField(entry, 'title')).toBe('My Title')
  })

  it('returns null when field does not exist on entry', () => {
    const entry: StrapiEntry = { documentId: '1', slug: 'test' }

    expect(getEntryField(entry, 'hero')).toBeNull()
  })

  it('returns complex objects as-is', () => {
    const entry: StrapiEntry = {
      documentId: '1',
      slug: 'test',
      hero: { title: 'Hero Title', description: 'Hero Desc' }
    }

    expect(getEntryField(entry, 'hero')).toEqual({
      title: 'Hero Title',
      description: 'Hero Desc'
    })
  })

  it('returns arrays as-is', () => {
    const entry: StrapiEntry = {
      documentId: '1',
      slug: 'test',
      content: [{ __component: 'blocks.paragraph', content: 'text' }]
    }

    expect(getEntryField(entry, 'content')).toEqual([
      { __component: 'blocks.paragraph', content: 'text' }
    ])
  })
})

// Core transformation from MDX files to Strapi API payloads.
// Handles validation, hero section logic, and content block creation.
describe('buildPagePayload', () => {
  describe('error handling', () => {
    it('throws when frontmatter fails validation', () => {
      const mdx = createMdxFile({
        slug: 'test'
      })

      expect(() =>
        buildPagePayload(foundationPageFrontmatterSchema, mdx, null)
      ).toThrow()
    })
  })

  describe('base payload fields', () => {
    it('includes title from frontmatter', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About Us' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.title).toBe('About Us')
    })

    it('includes slug from mdx file', () => {
      const mdx = createMdxFile({
        slug: 'about-page',
        frontmatter: { title: 'About' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.slug).toBe('about-page')
    })

    it('includes publishedAt timestamp', () => {
      const mdx = createMdxFile({
        slug: 'test',
        frontmatter: { title: 'Test' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.publishedAt).toBeDefined()
      expect(typeof payload.publishedAt).toBe('string')
    })

    it('accepts optional schema fields (description, heroImage, sections)', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: {
          title: 'About',
          description: 'Page description',
          heroImage: '/images/hero.jpg',
          sections: [
            { title: 'Section 1', content: 'Content 1' },
            {
              title: 'Section 2',
              content: 'Content 2',
              ctas: [{ label: 'Learn', href: '/learn' }]
            }
          ]
        }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.title).toBe('About')
      expect(payload.slug).toBe('about')
    })
  })

  // Hero section can come from MDX frontmatter OR be preserved from existing Strapi entry.
  // This lets us update title/content without losing hero images set in Strapi admin.
  describe('hero fallback logic', () => {
    it('uses frontmatter heroTitle and heroDescription when provided', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'Welcome',
          heroDescription: 'Learn about us'
        }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.hero).toEqual({
        title: 'Welcome',
        description: 'Learn about us'
      })
    })

    // If only description is provided, use the page title as hero title
    it('uses title as hero title when heroTitle not provided but heroDescription is', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: {
          title: 'About Page',
          heroDescription: 'Description only'
        }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.hero).toEqual({
        title: 'About Page',
        description: 'Description only'
      })
    })

    it('uses empty description when heroTitle provided but heroDescription is not', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'Hero Only'
        }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.hero).toEqual({
        title: 'Hero Only',
        description: ''
      })
    })

    // Key feature: if MDX doesn't have hero fields, keep whatever's in Strapi.
    // This preserves hero images uploaded via Strapi admin UI.
    it('preserves existing hero when no hero fields in frontmatter', () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        slug: 'about',
        hero: { title: 'Existing Hero', description: 'Kept intact' }
      }
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, existingEntry)

      expect(payload.hero).toEqual({
        title: 'Existing Hero',
        description: 'Kept intact'
      })
    })

    // No hero in MDX + no existing entry = no hero in payload
    it('does not include hero when no frontmatter hero and no existing entry', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.hero).toBeUndefined()
    })

    // MDX hero fields take precedence over Strapi — intentional override
    it('overrides existing hero when frontmatter has hero fields', () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        slug: 'about',
        hero: { title: 'Old Hero', description: 'Old desc' }
      }
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'New Hero',
          heroDescription: 'New desc'
        }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, existingEntry)

      expect(payload.hero).toEqual({
        title: 'New Hero',
        description: 'New desc'
      })
    })
  })

  // Content is stored as a paragraph block component. Empty content preserves existing.
  describe('content block handling', () => {
    it('creates content block with markdown when mdx has body', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' },
        content: '## Heading\n\nParagraph text'
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.content).toEqual([
        {
          __component: 'blocks.paragraph',
          content: '## Heading\n\nParagraph text'
        }
      ])
    })

    // Same fallback logic as hero — empty MDX body preserves Strapi content
    it('preserves existing content when mdx body is empty', () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        slug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Existing' }]
      }
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, existingEntry)

      expect(payload.content).toEqual([
        { __component: 'blocks.paragraph', content: 'Existing' }
      ])
    })

    // Whitespace-only should be treated as empty
    it('preserves existing content when mdx body is whitespace only', () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        slug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Kept' }]
      }
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' },
        content: '   \n\n   '
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, existingEntry)

      expect(payload.content).toEqual([
        { __component: 'blocks.paragraph', content: 'Kept' }
      ])
    })

    it('does not include content when no mdx body and no existing entry', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.content).toBeUndefined()
    })

    it('overrides existing content when mdx has body', () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        slug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Old content' }]
      }
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' },
        content: 'New content'
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, existingEntry)

      expect(payload.content).toEqual([
        { __component: 'blocks.paragraph', content: 'New content' }
      ])
    })

    it('handles content with null existing entry', () => {
      const mdx = createMdxFile({
        slug: 'about',
        frontmatter: { title: 'About' },
        content: undefined
      })

      const payload = buildPagePayload(foundationPageFrontmatterSchema, mdx, null)

      expect(payload.content).toBeUndefined()
    })
  })

  describe('summit-pages content type', () => {
    it('processes summit-pages same as foundation-pages', () => {
      const mdx = createMdxFile({
        slug: 'schedule',
        frontmatter: { title: 'Schedule' },
        content: 'Summit content'
      })

      const payload = buildPagePayload(summitPageFrontmatterSchema, mdx, null)

      expect(payload.title).toBe('Schedule')
      expect(payload.slug).toBe('schedule')
      expect(payload.content).toEqual([
        { __component: 'blocks.paragraph', content: 'Summit content' }
      ])
    })
  })
})
