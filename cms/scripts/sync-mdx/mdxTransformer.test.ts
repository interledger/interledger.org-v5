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
    pathSlug: z.string().min(1, 'slug is required'),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    sections: z.array(sectionSchema).optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  const grantCtaStripSchema = z.object({
    heading: z.string(),
    description: z.string(),
    buttonText: z.string(),
    buttonLink: z.string(),
    color: z.enum(['purple', 'green']).default('purple'),
    secondaryButtonText: z.string().optional(),
    secondaryButtonLink: z.string().optional()
  })
  const grantPageSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    description: z.string().min(1, 'description is required'),
    primaryCta: z
      .object({
        text: z.string(),
        link: z.string(),
        external: z.boolean().optional()
      })
      .optional(),
    ctaStrip: grantCtaStripSchema,
    metaDescription: z.string().optional(),
    metaImage: z.string().optional(),
    canonicalUrl: z.string().optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  const grantOverviewPageSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    description: z.string().min(1, 'description is required'),
    ctaStrip: grantCtaStripSchema,
    metaDescription: z.string().optional(),
    metaImage: z.string().optional(),
    canonicalUrl: z.string().optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  return {
    foundationPageFrontmatterSchema: pageSchema,
    summitPageFrontmatterSchema: pageSchema,
    grantPageFrontmatterSchema: grantPageSchema,
    grantOverviewPageFrontmatterSchema: grantOverviewPageSchema
  }
})

import {
  getEntryField,
  buildPagePayload,
  buildGrantPagePayload,
  buildGrantOverviewPagePayload
} from './mdxTransformer'
import {
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema
} from './siteSchemas'
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
      pathSlug: 'test',
      title: 'My Title'
    }

    expect(getEntryField(entry, 'title')).toBe('My Title')
  })

  it('returns null when field does not exist on entry', () => {
    const entry: StrapiEntry = { documentId: '1', pathSlug: 'test' }

    expect(getEntryField(entry, 'hero')).toBeNull()
  })

  it('returns complex objects as-is', () => {
    const entry: StrapiEntry = {
      documentId: '1',
      pathSlug: 'test',
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
      pathSlug: 'test',
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
    it('returns Error when frontmatter fails validation', async () => {
      const mdx = createMdxFile({
        pathSlug: 'test'
      })

      const result = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )
      expect(result).toBeInstanceOf(Error)
    })
  })

  describe('base payload fields', () => {
    it('includes title from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About Us' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).title).toBe('About Us')
    })

    it('includes slug from mdx file', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about-page',
        frontmatter: { title: 'About' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).pathSlug).toBe('about-page')
    })

    it('includes publishedAt timestamp', async () => {
      const mdx = createMdxFile({
        pathSlug: 'test',
        frontmatter: { title: 'Test' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).publishedAt).toBeDefined()
      expect(typeof (payload as Record<string, unknown>).publishedAt).toBe(
        'string'
      )
    })

    it('accepts optional schema fields (description, heroImage, sections)', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
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

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).title).toBe('About')
      expect((payload as Record<string, unknown>).pathSlug).toBe('about')
    })
  })

  // Hero is built from MDX frontmatter; absent hero fields clear the hero
  // in Strapi rather than preserving whatever was there before.
  describe('hero fallback logic', () => {
    it('uses frontmatter heroTitle and heroDescription when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'Welcome',
          heroDescription: 'Learn about us'
        }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: 'Learn about us'
      })
    })

    it('uses empty description when heroTitle provided but heroDescription is not', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'Hero Only'
        }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Hero Only',
        description: ''
      })
    })

    // The MDX file is the source of truth: a hero removed from Astro must be
    // cleared in Strapi too, not left as whatever Strapi already had.
    it('clears the existing hero when no hero fields in frontmatter', async () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        pathSlug: 'about',
        hero: { title: 'Existing Hero', description: 'Kept intact' }
      }
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        existingEntry
      )

      expect((payload as Record<string, unknown>).hero).toBeNull()
    })

    // No hero in MDX + no existing entry = hero explicitly cleared, not omitted
    it('sends null hero when no frontmatter hero and no existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).hero).toBeNull()
    })

    // MDX hero fields take precedence over Strapi — intentional override
    it('overrides existing hero when frontmatter has hero fields', async () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        pathSlug: 'about',
        hero: { title: 'Old Hero', description: 'Old desc' }
      }
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: {
          title: 'About',
          heroTitle: 'New Hero',
          heroDescription: 'New desc'
        }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        existingEntry
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'New Hero',
        description: 'New desc'
      })
    })
  })

  // Content is stored as a paragraph block component. Empty content preserves existing.
  describe('content block handling', () => {
    it('creates content block with markdown when mdx has body', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' },
        content: '## Heading\n\nParagraph text'
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.paragraph',
          content: '## Heading\n\nParagraph text'
        }
      ])
    })

    // Same fallback logic as hero — empty MDX body preserves Strapi content
    it('preserves existing content when mdx body is empty', async () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        pathSlug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Existing' }]
      }
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        existingEntry
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        { __component: 'blocks.paragraph', content: 'Existing' }
      ])
    })

    // Whitespace-only should be treated as empty
    it('preserves existing content when mdx body is whitespace only', async () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        pathSlug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Kept' }]
      }
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' },
        content: '   \n\n   '
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        existingEntry
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        { __component: 'blocks.paragraph', content: 'Kept' }
      ])
    })

    it('does not include content when no mdx body and no existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' }
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).content).toBeUndefined()
    })

    it('overrides existing content when mdx has body', async () => {
      const existingEntry: StrapiEntry = {
        documentId: '1',
        pathSlug: 'about',
        content: [{ __component: 'blocks.paragraph', content: 'Old content' }]
      }
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' },
        content: 'New content'
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        existingEntry
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        { __component: 'blocks.paragraph', content: 'New content' }
      ])
    })

    it('handles content with null existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'about',
        frontmatter: { title: 'About' },
        content: undefined
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).content).toBeUndefined()
    })
  })

  describe('summit-pages content type', () => {
    it('processes summit-pages same as foundation-pages', async () => {
      const mdx = createMdxFile({
        pathSlug: 'schedule',
        frontmatter: { title: 'Schedule' },
        content: 'Summit content'
      })

      const payload = await buildPagePayload(
        summitPageFrontmatterSchema,
        mdx,
        null
      )

      expect((payload as Record<string, unknown>).title).toBe('Schedule')
      expect((payload as Record<string, unknown>).pathSlug).toBe('schedule')
      expect((payload as Record<string, unknown>).content).toEqual([
        { __component: 'blocks.paragraph', content: 'Summit content' }
      ])
    })
  })

  // Parser integration: when parserCtx is provided, MDX body is parsed into
  // structured blocks instead of a single paragraph.
  describe('parser integration', () => {
    it('parses JSX into structured blocks when parserCtx is provided', async () => {
      // Import handler side-effects to register ProfileCard
      await import('./profileHandler')

      const parserCtx = {
        locale: 'en',
        resolveRelation: async (_apiId: string, pathSlug: string) => ({
          documentId: `doc-${pathSlug}`
        })
      }

      const mdx = createMdxFile({
        pathSlug: 'profiles-page',
        frontmatter: { title: 'Profiles' },
        content: '<ProfileCard pathSlug="alice" />'
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null,
        parserCtx
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.profile',
          profile: { connect: [{ documentId: 'doc-alice' }] }
        }
      ])
    })

    it('returns parser error with file slug context', async () => {
      await import('./profileHandler')

      const parserCtx = {
        locale: 'en',
        resolveRelation: async () => ({ documentId: 'doc-x' })
      }

      const mdx = createMdxFile({
        pathSlug: 'bad-page',
        frontmatter: { title: 'Bad' },
        content: '<UnknownWidget />'
      })

      const result = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null,
        parserCtx
      )
      expect(result).toBeInstanceOf(Error)
      expect((result as Error).message).toMatch(/bad-page/)
    })
  })

  describe('buildPagePayload locale context', () => {
    it('parses locale MDX body with Blockquote into structured blocks', async () => {
      await import('./blockquoteHandler')

      const parserCtx = { locale: 'es' }

      const mdx = createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        isLocalization: true,
        localizes: 'about-us',
        frontmatter: {
          title: 'Sobre Nosotros',
          localizes: 'about-us',
          locale: 'es'
        },
        content: '<Blockquote source="Autor">\nUna cita.\n</Blockquote>'
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null,
        parserCtx
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.blockquote',
          quote: 'Una cita.',
          source: 'Autor'
        }
      ])
    })

    it('passes locale through parserCtx for relation resolution', async () => {
      await import('./profileHandler')

      const resolveRelation = vi.fn(
        async (_apiId: string, pathSlug: string) => ({
          documentId: `doc-${pathSlug}`
        })
      )

      const parserCtx = { locale: 'es', resolveRelation }

      const mdx = createMdxFile({
        pathSlug: 'perfiles',
        locale: 'es',
        isLocalization: true,
        localizes: 'profiles-page',
        frontmatter: {
          title: 'Perfiles',
          localizes: 'profiles-page',
          locale: 'es'
        },
        content: '<ProfileCard pathSlug="alice" />'
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null,
        parserCtx
      )

      expect(resolveRelation).toHaveBeenCalledWith('profile-pages', 'alice')
      expect(payload.content).toEqual([
        {
          __component: 'blocks.profile',
          profile: { connect: [{ documentId: 'doc-alice' }] }
        }
      ])
    })

    it('locale MDX with mixed content preserves block order', async () => {
      await import('./blockquoteHandler')
      await import('./calloutTextHandler')

      const parserCtx = { locale: 'es' }

      const mdx = createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        isLocalization: true,
        localizes: 'about-us',
        frontmatter: {
          title: 'Sobre Nosotros',
          localizes: 'about-us',
          locale: 'es'
        },
        content: [
          'Texto introductorio.',
          '',
          '<Blockquote source="Autor">Una cita.</Blockquote>',
          '',
          '<CalloutText>Nota importante.</CalloutText>'
        ].join('\n')
      })

      const payload = await buildPagePayload(
        foundationPageFrontmatterSchema,
        mdx,
        null,
        parserCtx
      )

      const content = (payload as Record<string, unknown>).content as Array<
        Record<string, unknown>
      >
      expect(content).toHaveLength(3)
      expect(content[0]).toMatchObject({ __component: 'blocks.paragraph' })
      expect(content[1]).toMatchObject({
        __component: 'blocks.blockquote',
        quote: 'Una cita.',
        source: 'Autor'
      })
      expect(content[2]).toMatchObject({
        __component: 'blocks.callout-text',
        content: 'Nota importante.'
      })
    })
  })
})

// Helpers for grant-page tests
const baseGrantFrontmatter = {
  title: 'On-Campus Grant',
  description: 'Funding for campus programmes.',
  ctaStrip: {
    heading: 'Apply now',
    description: 'Deadline approaching.',
    buttonText: 'Start application',
    buttonLink: 'https://example.com/apply'
  }
}

// Maps grant-page MDX frontmatter to the Strapi grant-page payload shape.
// Key risks: CTA field name translation (buttonText→primaryButtonText, etc.)
// and optional primaryCta / seo being omitted when absent.
describe('buildGrantPagePayload', () => {
  describe('error handling', () => {
    it('returns Error when title is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          description: 'Some description',
          ctaStrip: baseGrantFrontmatter.ctaStrip
        }
      })

      const result = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when description is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          title: 'On-Campus Grant',
          ctaStrip: baseGrantFrontmatter.ctaStrip
        }
      })

      const result = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when ctaStrip is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: { title: 'On-Campus Grant', description: 'Funding.' }
      })

      const result = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })
  })

  describe('base payload fields', () => {
    it('includes title from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).title).toBe('On-Campus Grant')
    })

    it('includes pathSlug from mdx file', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).pathSlug).toBe(
        'education/on-campus'
      )
    })

    it('includes description from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).description).toBe(
        'Funding for campus programmes.'
      )
    })

    it('includes publishedAt timestamp', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect(typeof (payload as Record<string, unknown>).publishedAt).toBe(
        'string'
      )
    })
  })

  // CTA strip field names differ between MDX frontmatter and the Strapi
  // blocks.cta-strip component. Wrong mapping here silently wipes button text.
  describe('CTA strip field mapping', () => {
    it('maps buttonText to primaryButtonText', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.primaryButtonText).toBe('Start application')
    })

    it('maps buttonLink to primaryButtonLink', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.primaryButtonLink).toBe('https://example.com/apply')
    })

    it('sets default color to purple', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.color).toBe('purple')
    })

    it('includes heading and description from ctaStrip frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.heading).toBe('Apply now')
      expect(ctaStrip.description).toBe('Deadline approaching.')
    })

    it('passes through color when set to green', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          ctaStrip: { ...baseGrantFrontmatter.ctaStrip, color: 'green' }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.color).toBe('green')
    })

    it('does not include secondary button fields when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(
        Object.prototype.hasOwnProperty.call(ctaStrip, 'secondaryButtonText')
      ).toBe(false)
      expect(
        Object.prototype.hasOwnProperty.call(ctaStrip, 'secondaryButtonLink')
      ).toBe(false)
    })

    it('includes secondary button fields when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          ctaStrip: {
            ...baseGrantFrontmatter.ctaStrip,
            secondaryButtonText: 'Learn more',
            secondaryButtonLink: 'https://example.com/info'
          }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.secondaryButtonText).toBe('Learn more')
      expect(ctaStrip.secondaryButtonLink).toBe('https://example.com/info')
    })
  })

  describe('optional primaryCta', () => {
    it('is null in payload when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).primaryCta).toBeNull()
    })

    it('is included with correct fields when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          primaryCta: {
            text: 'Apply Now',
            link: 'https://example.com/apply',
            external: true
          }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).primaryCta).toEqual({
        text: 'Apply Now',
        link: 'https://example.com/apply',
        external: true
      })
    })

    it('defaults external to false when not specified', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          primaryCta: { text: 'Apply Now', link: 'https://example.com/apply' }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const primaryCta = (payload as Record<string, unknown>)
        .primaryCta as Record<string, unknown>
      expect(primaryCta.external).toBe(false)
    })
  })

  // Only metaDescription is synced to Strapi's seo component.
  // metaImage requires a media upload ID (not a URL) so it is not synced;
  // canonicalUrl is not currently supported by the grant-page sync.
  describe('SEO fields', () => {
    it('seo is null when metaDescription is not set', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).seo).toBeNull()
    })

    it('seo is null even when only metaImage or canonicalUrl are set', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          metaImage: '/img/grant-og.png',
          canonicalUrl: 'https://interledger.org/grant/education/on-campus'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).seo).toBeNull()
    })

    it('seo contains metaDescription when metaDescription is set', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          metaDescription: 'SEO description for the grant page.'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).seo).toEqual({
        metaDescription: 'SEO description for the grant page.'
      })
    })
  })

  describe('programOverview', () => {
    it('is set from mdx.content when body is present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: '## Eligibility\n\n- Accredited institutions'
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBe(
        '## Eligibility\n\n- Accredited institutions'
      )
    })

    it('is null when mdx body is empty', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: ''
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBeNull()
    })

    it('is null when mdx body is whitespace only', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: '   \n\n   '
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBeNull()
    })
  })
})

const baseGrantOverviewFrontmatter = {
  title: 'Digital Finance Grants',
  description: 'We fund digital finance initiatives.',
  ctaStrip: {
    heading: 'Ready to apply?',
    description: 'Explore our grant programs.',
    buttonText: 'See grant programs',
    buttonLink: 'https://example.com/grants'
  }
}

// Maps grant-overview-page MDX frontmatter to the Strapi grant-overview-page payload shape.
// Key risks: CTA field name translation (buttonText→primaryButtonText, etc.)
// and optional seo / external being omitted when absent.
describe('buildGrantOverviewPagePayload', () => {
  describe('error handling', () => {
    it('returns Error when title is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          description: 'Some description',
          ctaStrip: baseGrantOverviewFrontmatter.ctaStrip
        }
      })

      const result = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when description is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          title: 'Digital Finance Grants',
          ctaStrip: baseGrantOverviewFrontmatter.ctaStrip
        }
      })

      const result = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when ctaStrip is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          title: 'Digital Finance Grants',
          description: 'Some description.'
        }
      })

      const result = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect(result).toBeInstanceOf(Error)
    })
  })

  describe('base payload fields', () => {
    it('includes title, pathSlug, and description', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      const p = payload as Record<string, unknown>
      expect(p.title).toBe('Digital Finance Grants')
      expect(p.pathSlug).toBe('digital-finance')
      expect(p.description).toBe('We fund digital finance initiatives.')
    })

    it('maps ctaStrip frontmatter names to Strapi field names', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.heading).toBe('Ready to apply?')
      expect(ctaStrip.description).toBe('Explore our grant programs.')
      expect(ctaStrip.primaryButtonText).toBe('See grant programs')
      expect(ctaStrip.primaryButtonLink).toBe('https://example.com/grants')
    })

    it('includes color in ctaStrip (defaults to purple)', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.color).toBe('purple')
    })

    it('omits secondaryButtonText/Link when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip).not.toHaveProperty('secondaryButtonText')
      expect(ctaStrip).not.toHaveProperty('secondaryButtonLink')
    })

    it('includes secondaryButtonText/Link when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          ctaStrip: {
            ...baseGrantOverviewFrontmatter.ctaStrip,
            secondaryButtonText: 'Learn more',
            secondaryButtonLink: 'https://example.com/learn'
          }
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      const ctaStrip = (payload as Record<string, unknown>).ctaStrip as Record<
        string,
        unknown
      >
      expect(ctaStrip.secondaryButtonText).toBe('Learn more')
      expect(ctaStrip.secondaryButtonLink).toBe('https://example.com/learn')
    })
  })

  describe('seo', () => {
    it('omits seo when metaDescription is absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).seo).toBeNull()
    })

    it('includes metaDescription in seo when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          metaDescription: 'SEO description.'
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect(
        ((payload as Record<string, unknown>).seo as Record<string, unknown>)
          .metaDescription
      ).toBe('SEO description.')
    })
  })

  describe('followUpContent', () => {
    it('includes MDX body as followUpContent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content: 'Some follow-up text.'
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).followUpContent).toBe(
        'Some follow-up text.'
      )
    })

    it('sets followUpContent to null when body is empty', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content: '   \n\n   '
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).followUpContent).toBeNull()
    })
  })
})
