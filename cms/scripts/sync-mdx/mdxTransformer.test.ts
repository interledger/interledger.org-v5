import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const mockProjectRootHolder = vi.hoisted(() => ({ current: '' }))

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getProjectRoot: () => mockProjectRootHolder.current
  }
})

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
  const grantFaqItemSchema = z.object({
    question: z.string(),
    answer: z.string()
  })
  const grantFaqSectionSchema = z.object({
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    ctaText: z.string(),
    ctaLink: z.string(),
    items: z.array(grantFaqItemSchema).min(2)
  })
  const grantInfoCardSchema = z.object({
    heading: z.string().min(1, 'card heading is required'),
    body: z.string().min(1, 'card body is required')
  })
  const grantInfoCardsSchema = z.object({
    heading: z.string().optional(),
    cards: z.tuple([
      grantInfoCardSchema,
      grantInfoCardSchema,
      grantInfoCardSchema
    ])
  })
  const grantPageSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    description: z.string().min(1, 'description is required'),
    programOverview: z.string().optional(),
    primaryCta: z
      .object({
        text: z.string(),
        link: z.string(),
        external: z.boolean().optional()
      })
      .optional(),
    infoCards: grantInfoCardsSchema.optional(),
    ctaStrip: grantCtaStripSchema,
    faqSection: grantFaqSectionSchema.optional(),
    metaImage: z.string().optional(),
    canonicalUrl: z.string().optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  const grantOverviewPageSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    description: z.string().min(1, 'description is required'),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().nullable().optional(),
    heroImageMobile: z.string().optional(),
    heroImageMobileAlt: z.string().nullable().optional(),
    heroCtas: z
      .array(
        z.object({
          text: z.string(),
          link: z.string(),
          style: z.enum(['primary', 'secondary']).optional(),
          external: z.boolean().optional()
        })
      )
      .max(1)
      .optional(),
    ctaStrip: grantCtaStripSchema,
    metaImage: z.string().optional(),
    canonicalUrl: z.string().optional(),
    localizes: z.string().optional(),
    locale: z.string().optional()
  })
  const faqSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    section: z.enum(['summit', 'hackathon', 'foundation']),
    heading: z.string().min(1, 'heading is required'),
    description: z.string().min(1, 'description is required'),
    introParagraph: z.string().nullable().optional(),
    locale: z.string().optional(),
    localizes: z.string().optional()
  })
  const reportDateSchema = z.object({
    publishDate: z.coerce.date(),
    lastUpdated: z.coerce.date().optional()
  })
  const reportSchema = z.object({
    title: z.string().min(1, 'title is required'),
    pathSlug: z.string().min(1, 'pathSlug is required'),
    section: z.enum(['summit', 'hackathon', 'foundation']),
    heading: z.string().min(1, 'heading is required'),
    description: z.string().min(1, 'description is required'),
    introParagraph: z.string().nullable().optional(),
    date: reportDateSchema.optional(),
    locale: z.string(),
    localizes: z.string().optional()
  })
  return {
    foundationPageFrontmatterSchema: pageSchema,
    summitPageFrontmatterSchema: pageSchema,
    grantPageFrontmatterSchema: grantPageSchema,
    grantOverviewPageFrontmatterSchema: grantOverviewPageSchema,
    faqFrontmatterSchema: faqSchema,
    reportFrontmatterSchema: reportSchema
  }
})

import {
  getEntryField,
  buildPagePayload,
  buildGrantPagePayload,
  buildGrantOverviewPagePayload,
  buildFaqPayload,
  buildReportPayload,
  createMediaUploadResolver
} from './mdxTransformer'
import {
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  faqFrontmatterSchema,
  reportFrontmatterSchema
} from './siteSchemas'
import type { StrapiEntry } from './strapiClient'
import type { StrapiUploadContext } from './mdxTransformer'
import type { StrapiClient } from './strapiClient'
import { createMdxFile } from './test-utils'

function createMockStrapiUploadContext(uploads: Record<string, number> = {}): {
  strapiUploadContext: StrapiUploadContext
  updatedAltIds: Map<number, string | null>
} {
  const updatedAltIds = new Map<number, string | null>()
  const strapi = {
    findUploadByUrl: vi.fn((url: string) =>
      Promise.resolve(uploads[url] ?? null)
    ),
    findUploadByName: vi.fn().mockResolvedValue(null),
    updateUploadAlt: vi.fn().mockResolvedValue(undefined)
  }

  return {
    strapiUploadContext: {
      strapi,
      STRAPI_URL: 'http://localhost:1337',
      STRAPI_TOKEN: 'token',
      dryRun: false
    },
    updatedAltIds
  }
}

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
  // Shared stub: content parsing (JSX -> dynamic-zone blocks) and hero image
  // resolution only run when a strapi upload context is supplied — mirrors
  // buildPagePayload's parserCtx-gated behavior for foundation/summit pages.
  function stubStrapi(
    uploads: Record<string, number> = {}
  ): StrapiUploadContext {
    return {
      strapi: {
        findUploadByUrl: async (url: string) => uploads[url] ?? null,
        findUploadByName: async () => null,
        updateUploadAlt: async () => undefined
      } as unknown as StrapiClient,
      STRAPI_URL: 'http://localhost:1337',
      STRAPI_TOKEN: 'token',
      dryRun: false
    }
  }

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

  describe('programOverview', () => {
    it('syncs the frontmatter value through to Strapi', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          programOverview: '## Eligibility\n\n- Accredited institutions'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBe(
        '## Eligibility\n\n- Accredited institutions'
      )
    })

    it('is null when absent from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBeNull()
    })

    it('is null when frontmatter value is blank', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: { ...baseGrantFrontmatter, programOverview: '' }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).programOverview).toBeNull()
    })
  })

  describe('content dynamic zone', () => {
    it('parses plain markdown body into a blocks.paragraph block', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: '## Eligibility\n\n- Accredited institutions'
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi()
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.paragraph',
          content: '## Eligibility\n\n- Accredited institutions'
        }
      ])
    })

    it('parses a <SplitLayout> component into a blocks.split-layout block', async () => {
      await import('./splitLayoutHandler')

      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content:
          '<SplitLayout imageSrc="/img/foo.jpg" imageAlt="Foo" imagePosition="left" ctaText="Apply" ctaLink="https://example.com">\n\nSome body copy.\n\n</SplitLayout>'
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi({ '/img/foo.jpg': 42 })
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.split-layout',
          layoutType: 'image-text',
          imagePosition: 'left',
          image: 42,
          imageAlt: 'Foo',
          content: 'Some body copy.',
          cta: { text: 'Apply', link: 'https://example.com' }
        }
      ])
    })

    it('does not include content when no mdx body and no existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: ''
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).content).toBeUndefined()
    })
  })

  describe('optional faqSection', () => {
    it('is null in payload when absent from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).faqSection).toBeNull()
    })

    it('serializes all fields and items when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          faqSection: {
            title: 'Common Questions',
            subtitle: 'Get in touch',
            description: 'We are happy to help.',
            ctaText: 'Contact us',
            ctaLink: 'mailto:grants@interledger.foundation',
            items: [
              {
                question: 'Who can apply?',
                answer: 'Any accredited institution.'
              },
              { question: 'How much funding?', answer: 'Up to $50,000.' }
            ]
          }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const faqSection = (payload as Record<string, unknown>)
        .faqSection as Record<string, unknown>
      expect(faqSection.title).toBe('Common Questions')
      expect(faqSection.subtitle).toBe('Get in touch')
      expect(faqSection.description).toBe('We are happy to help.')
      expect(faqSection.ctaText).toBe('Contact us')
      expect(faqSection.ctaLink).toBe('mailto:grants@interledger.foundation')
      expect(faqSection.items).toEqual([
        { question: 'Who can apply?', answer: 'Any accredited institution.' },
        { question: 'How much funding?', answer: 'Up to $50,000.' }
      ])
    })
  })

  // infoCards.cards is a 3-tuple in frontmatter but maps to fixed
  // card1/card2/card3 fields on the Strapi component. Wrong indexing here
  // would silently swap or drop a card.
  describe('optional infoCards', () => {
    const threeCards = [
      { heading: 'Why Apply', body: 'Funding to support your project.' },
      { heading: 'Eligibility', body: 'Open to individuals and orgs.' },
      { heading: 'Application Steps', body: 'Complete the online form.' }
    ]

    it('is null in payload when absent from frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).infoCards).toBeNull()
    })

    it('maps cards[0..2] to card1/card2/card3', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          infoCards: { cards: threeCards }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const infoCards = (payload as Record<string, unknown>)
        .infoCards as Record<string, unknown>
      expect(infoCards.card1).toEqual(threeCards[0])
      expect(infoCards.card2).toEqual(threeCards[1])
      expect(infoCards.card3).toEqual(threeCards[2])
    })

    it('does not include heading when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          infoCards: { cards: threeCards }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const infoCards = (payload as Record<string, unknown>)
        .infoCards as Record<string, unknown>
      expect(Object.prototype.hasOwnProperty.call(infoCards, 'heading')).toBe(
        false
      )
    })

    it('includes heading when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          infoCards: { heading: 'What to expect', cards: threeCards }
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )
      const infoCards = (payload as Record<string, unknown>)
        .infoCards as Record<string, unknown>
      expect(infoCards.heading).toBe('What to expect')
    })
  })

  // Content parsing: the MDX body (e.g. <LogoCarousel>) is only parsed into
  // `content` when a strapi client is supplied — mirrors buildPagePayload's
  // parserCtx-gated behavior for foundation/summit pages.
  describe('content parsing', () => {
    it('parses a LogoCarousel body into a blocks.carousel content entry when strapi is provided', async () => {
      // Import handler side-effects to register LogoCarousel
      await import('./carouselHandler')

      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'Plata', src: '/img/plata.png' }]} />`
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi({ '/img/plata.png': 12 })
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.carousel',
          accessibilityLabel: 'Our Partners',
          logos: [12]
        }
      ])
    })

    it('omits content when body is empty and there is no existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: ''
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi()
      )

      expect(payload).not.toHaveProperty('content')
    })

    it('preserves existing content when body is empty', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: ''
      })
      const existing = {
        content: [{ __component: 'blocks.carousel', logos: [99] }]
      } as unknown as StrapiEntry

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi(),
        existing
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        { __component: 'blocks.carousel', logos: [99] }
      ])
    })

    it('does not parse content when no strapi client is provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter,
        content: ''
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )

      expect(payload).not.toHaveProperty('content')
    })
  })

  describe('hero', () => {
    it('uses frontmatter heroTitle and heroDescription when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          heroTitle: 'Welcome',
          heroDescription: 'Learn about our grants'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: 'Learn about our grants'
      })
    })

    it('includes hero CTA when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          heroTitle: 'Welcome',
          heroCtas: [{ text: 'Apply now', link: '/apply', external: true }]
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: '',
        hero_call_to_action: {
          text: 'Apply now',
          link: '/apply',
          style: 'primary',
          external: true
        }
      })
    })

    it('clears hero when no hero fields are present in frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: baseGrantFrontmatter
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toBeNull()
    })

    it('resolves heroImage to a Strapi upload ID', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          heroTitle: 'Welcome',
          heroImage: '/uploads/img/hero-desktop.png',
          heroImageAlt: 'Grant hero'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi({ '/uploads/img/hero-desktop.png': 42 })
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: '',
        backgroundImage: 42
      })
    })

    it('defaults hero title to the page title when heroTitle is absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'education/on-campus',
        frontmatter: {
          ...baseGrantFrontmatter,
          heroImage: '/uploads/img/hero-desktop.png'
        }
      })

      const payload = await buildGrantPagePayload(
        grantPageFrontmatterSchema,
        mdx,
        stubStrapi({ '/uploads/img/hero-desktop.png': 42 })
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: baseGrantFrontmatter.title,
        description: '',
        backgroundImage: 42
      })
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
// Key risk: CTA field name translation (buttonText→primaryButtonText, etc.)
describe('buildGrantOverviewPagePayload', () => {
  // Shared stub: content parsing (JSX -> dynamic-zone blocks) only runs when
  // a strapi client is supplied — mirrors buildGrantPagePayload's
  // parserCtx-gated behavior.
  function stubStrapi(uploads: Record<string, number> = {}): StrapiClient {
    return {
      findUploadByUrl: async (url: string) => uploads[url] ?? null,
      updateUploadAlt: async () => undefined
    } as unknown as StrapiClient
  }

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

  describe('followUpContent', () => {
    it('is always null once content is parsed into dynamic-zone blocks', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content: 'Some follow-up text.'
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )
      expect((payload as Record<string, unknown>).followUpContent).toBeNull()
    })

    it('is null when body is empty', async () => {
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

  describe('hero', () => {
    it('uses frontmatter heroTitle and heroDescription when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroTitle: 'Welcome',
          heroDescription: 'Learn about our grants'
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: 'Learn about our grants'
      })
    })

    it('includes hero CTA when provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroTitle: 'Welcome',
          heroCtas: [{ text: 'Apply now', link: '/apply', external: true }]
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: '',
        hero_call_to_action: {
          text: 'Apply now',
          link: '/apply',
          style: 'primary',
          external: true
        }
      })
    })

    it('clears hero when no hero fields are present in frontmatter', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).hero).toBeNull()
    })

    it('resolves heroImage to a Strapi upload ID', async () => {
      const { strapiUploadContext, updatedAltIds } =
        createMockStrapiUploadContext({
          '/uploads/img/hero-desktop.png': 42
        })
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroTitle: 'Welcome',
          heroImage: '/uploads/img/hero-desktop.png',
          heroImageAlt: 'Grant hero'
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        strapiUploadContext,
        updatedAltIds
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: 'Welcome',
        description: '',
        backgroundImage: 42
      })
      expect(strapiUploadContext.strapi.updateUploadAlt).toHaveBeenCalledWith(
        42,
        'Grant hero'
      )
    })

    it('resolves heroImageMobile to a Strapi upload ID', async () => {
      const { strapiUploadContext, updatedAltIds } =
        createMockStrapiUploadContext({
          '/uploads/img/hero-mobile.png': 84
        })
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroImageMobile: '/uploads/img/hero-mobile.png',
          heroImageMobileAlt: 'Mobile grant hero'
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        strapiUploadContext,
        updatedAltIds
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: baseGrantOverviewFrontmatter.title,
        description: '',
        backgroundImageMobile: 84
      })
      expect(strapiUploadContext.strapi.updateUploadAlt).toHaveBeenCalledWith(
        84,
        'Mobile grant hero'
      )
    })

    it('clears heroImage when heroImage is explicitly empty in frontmatter', async () => {
      const { strapiUploadContext, updatedAltIds } =
        createMockStrapiUploadContext()
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroImage: ''
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        strapiUploadContext,
        updatedAltIds
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: baseGrantOverviewFrontmatter.title,
        description: '',
        backgroundImage: null
      })
    })

    it('defaults hero title to the page title when heroTitle is absent', async () => {
      const { strapiUploadContext, updatedAltIds } =
        createMockStrapiUploadContext({
          '/uploads/img/hero-desktop.png': 42
        })
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: {
          ...baseGrantOverviewFrontmatter,
          heroImage: '/uploads/img/hero-desktop.png'
        }
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        strapiUploadContext,
        updatedAltIds
      )

      expect((payload as Record<string, unknown>).hero).toEqual({
        title: baseGrantOverviewFrontmatter.title,
        description: '',
        backgroundImage: 42
      })
    })
  })

  describe('content dynamic zone', () => {
    it('parses plain markdown body into a blocks.paragraph block', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content: '## Eligibility\n\n- Accredited institutions'
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        {
          strapi: stubStrapi(),
          STRAPI_URL: '',
          STRAPI_TOKEN: '',
          dryRun: false
        }
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.paragraph',
          content: '## Eligibility\n\n- Accredited institutions'
        }
      ])
    })

    it('parses a <SplitLayout> component into a blocks.split-layout block', async () => {
      await import('./splitLayoutHandler')

      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content:
          '<SplitLayout imageSrc="/img/foo.jpg" imageAlt="Foo" imagePosition="left" ctaText="Apply" ctaLink="https://example.com">\n\nSome body copy.\n\n</SplitLayout>'
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        {
          strapi: stubStrapi({ '/img/foo.jpg': 42 }),
          STRAPI_URL: '',
          STRAPI_TOKEN: '',
          dryRun: false
        }
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.split-layout',
          layoutType: 'image-text',
          imagePosition: 'left',
          image: 42,
          imageAlt: 'Foo',
          content: 'Some body copy.',
          cta: { text: 'Apply', link: 'https://example.com' }
        }
      ])
    })

    it('does not include content when no mdx body and no existing entry', async () => {
      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content: ''
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx
      )

      expect((payload as Record<string, unknown>).content).toBeUndefined()
    })

    it('parses a <NumberTiles> component into a blocks.number-tiles block', async () => {
      await import('./numberTilesHandler')

      const mdx = createMdxFile({
        pathSlug: 'digital-finance',
        frontmatter: baseGrantOverviewFrontmatter,
        content:
          "<NumberTiles tiles={[{ number: '21', suffix: 'M+', description: 'In Grants' }, { number: '300', suffix: '+', description: 'Projects supported worldwide' }]} />"
      })

      const payload = await buildGrantOverviewPagePayload(
        grantOverviewPageFrontmatterSchema,
        mdx,
        {
          strapi: stubStrapi(),
          STRAPI_URL: '',
          STRAPI_TOKEN: '',
          dryRun: false
        }
      )

      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.number-tiles',
          tiles: [
            { number: '21', suffix: 'M+', description: 'In Grants' },
            {
              number: '300',
              suffix: '+',
              description: 'Projects supported worldwide'
            }
          ]
        }
      ])
    })
  })
})

const baseFaqFrontmatter = {
  title: 'Frequently Asked Questions',
  section: 'foundation' as const,
  heading: 'Frequently Asked Questions',
  description: 'Answers to common questions, 120 to 160 characters.'
}

// Maps faq MDX frontmatter to the Strapi faq payload shape.
describe('buildFaqPayload', () => {
  describe('error handling', () => {
    it('returns Error when title is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: {
          section: 'foundation',
          heading: 'Frequently Asked Questions',
          description: 'A short description.',
          locale: 'en'
        }
      })

      const result = await buildFaqPayload(faqFrontmatterSchema, mdx)
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when heading is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: {
          title: 'Frequently Asked Questions',
          section: 'foundation',
          description: 'A short description.',
          locale: 'en'
        }
      })

      const result = await buildFaqPayload(faqFrontmatterSchema, mdx)
      expect(result).toBeInstanceOf(Error)
    })
  })

  describe('base payload fields', () => {
    it('includes title, pathSlug, section, heading, and description', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: baseFaqFrontmatter
      })

      const payload = await buildFaqPayload(faqFrontmatterSchema, mdx)
      const p = payload as Record<string, unknown>
      expect(p.title).toBe('Frequently Asked Questions')
      expect(p.pathSlug).toBe('faq')
      expect(p.section).toBe('foundation')
      expect(p.heading).toBe('Frequently Asked Questions')
      expect(p.description).toBe(
        'Answers to common questions, 120 to 160 characters.'
      )
    })

    it('includes introParagraph when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: {
          ...baseFaqFrontmatter,
          introParagraph: 'A short intro.'
        }
      })

      const payload = await buildFaqPayload(faqFrontmatterSchema, mdx)
      expect((payload as Record<string, unknown>).introParagraph).toBe(
        'A short intro.'
      )
    })

    it('sets introParagraph to null when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: baseFaqFrontmatter
      })

      const payload = await buildFaqPayload(faqFrontmatterSchema, mdx)
      expect((payload as Record<string, unknown>).introParagraph).toBeNull()
    })
  })

  describe('content dynamic zone', () => {
    it('does not parse content when no parser context is provided', async () => {
      const mdx = createMdxFile({
        pathSlug: 'faq',
        frontmatter: baseFaqFrontmatter,
        content: ''
      })

      const payload = await buildFaqPayload(faqFrontmatterSchema, mdx)

      expect(payload).not.toHaveProperty('content')
    })
  })
})

const baseReportFrontmatter = {
  title: 'The Role of Stablecoins',
  section: 'foundation',
  heading: 'The Role of Stablecoins',
  description: 'A short description of the report, 120 to 160 characters.',
  locale: 'en'
}

// Maps report MDX frontmatter to the Strapi report payload shape.
// Key risk: the optional `date` component — publishDate must round-trip when
// present and the whole component must be cleared (sent as null) when absent.
describe('buildReportPayload', () => {
  describe('error handling', () => {
    it('returns Error when title is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: {
          section: 'foundation',
          heading: 'The Role of Stablecoins',
          description: 'A short description.',
          locale: 'en'
        }
      })

      const result = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect(result).toBeInstanceOf(Error)
    })

    it('returns Error when heading is missing', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: {
          title: 'The Role of Stablecoins',
          section: 'foundation',
          description: 'A short description.',
          locale: 'en'
        }
      })

      const result = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect(result).toBeInstanceOf(Error)
    })
  })

  describe('base payload fields', () => {
    it('includes title, pathSlug, section, heading, and description', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: baseReportFrontmatter
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      const p = payload as Record<string, unknown>
      expect(p.title).toBe('The Role of Stablecoins')
      expect(p.pathSlug).toBe('policy-and-advocacy/role-stablecoins')
      expect(p.section).toBe('foundation')
      expect(p.heading).toBe('The Role of Stablecoins')
      expect(p.description).toBe(
        'A short description of the report, 120 to 160 characters.'
      )
    })

    it('includes introParagraph when present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: {
          ...baseReportFrontmatter,
          introParagraph: 'A short intro.'
        }
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect((payload as Record<string, unknown>).introParagraph).toBe(
        'A short intro.'
      )
    })

    it('sets introParagraph to null when absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: baseReportFrontmatter
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect((payload as Record<string, unknown>).introParagraph).toBeNull()
    })
  })

  describe('date component round-trip', () => {
    it('sets date to null when the date component is absent', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: baseReportFrontmatter
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect((payload as Record<string, unknown>).date).toBeNull()
    })

    it('round-trips publishDate when the date component is present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: {
          ...baseReportFrontmatter,
          date: { publishDate: '2026-06-15' }
        }
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      const date = (payload as Record<string, unknown>).date as Record<
        string,
        unknown
      >
      expect(date.publishDate).toBe('2026-06-15')
      expect(date).not.toHaveProperty('lastUpdated')
    })

    it('round-trips lastUpdated alongside publishDate when both are present', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: {
          ...baseReportFrontmatter,
          date: { publishDate: '2026-06-15', lastUpdated: '2026-07-01' }
        }
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      const date = (payload as Record<string, unknown>).date as Record<
        string,
        unknown
      >
      expect(date.publishDate).toBe('2026-06-15')
      expect(date.lastUpdated).toBe('2026-07-01')
    })
  })

  describe('content parsing', () => {
    it('includes MDX body as paragraph content', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: baseReportFrontmatter,
        content: 'The full report body.'
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      const content = (payload as Record<string, unknown>).content as Array<
        Record<string, unknown>
      >
      expect(content[0]?.__component).toBe('blocks.paragraph')
      expect(content[0]?.content).toBe('The full report body.')
    })

    it('omits content when the MDX body is empty', async () => {
      const mdx = createMdxFile({
        pathSlug: 'policy-and-advocacy/role-stablecoins',
        frontmatter: baseReportFrontmatter,
        content: '   \n\n   '
      })

      const payload = await buildReportPayload(reportFrontmatterSchema, mdx)
      expect(payload).not.toHaveProperty('content')
    })
  })
})

describe('createMediaUploadResolver', () => {
  let tempProjectRoot: string

  beforeEach(() => {
    tempProjectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'media-upload-resolver-test-')
    )
    mockProjectRootHolder.current = tempProjectRoot
  })

  afterEach(() => {
    fs.rmSync(tempProjectRoot, { recursive: true, force: true })
  })

  function writeLocalAsset(url: string): void {
    const absPath = path.join(tempProjectRoot, 'public', url)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, '')
  }

  it('returns the upload ID when found', async () => {
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(42)
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, false)
    await expect(resolve('/img/foo.png')).resolves.toBe(42)
  })

  it('throws when findUploadByUrl itself errors', async () => {
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(new Error('network down'))
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, true)
    await expect(resolve('/img/foo.png')).rejects.toThrow('network down')
  })

  it('not found + dry-run + file exists on disk: warns and returns null', async () => {
    writeLocalAsset(
      '/img/foundation-blog/2024-07-30/oauth-sequence-diagram.png'
    )
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(null)
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, true)
    await expect(
      resolve('/img/foundation-blog/2024-07-30/oauth-sequence-diagram.png')
    ).resolves.toBeNull()
  })

  it('not found + not dry-run: throws even if the file exists on disk', async () => {
    writeLocalAsset('/img/foo.png')
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(null)
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, false)
    await expect(resolve('/img/foo.png')).rejects.toThrow(
      'Upload "/img/foo.png" could not be resolved to a Strapi file ID.'
    )
  })

  it('not found + dry-run + file does NOT exist on disk: still throws (genuinely broken reference)', async () => {
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(null)
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, true)
    await expect(resolve('/img/missing.png')).rejects.toThrow(
      'Upload "/img/missing.png" could not be resolved to a Strapi file ID.'
    )
  })

  it('not found + dry-run + non-local-asset URL: still throws even if by coincidence a matching path exists on disk', async () => {
    const strapi = {
      findUploadByUrl: vi.fn().mockResolvedValue(null)
    } as unknown as StrapiClient

    const resolve = createMediaUploadResolver(strapi, true)
    await expect(
      resolve('https://example.com/not-a-local-asset.png')
    ).rejects.toThrow(
      'Upload "https://example.com/not-a-local-asset.png" could not be resolved to a Strapi file ID.'
    )
  })
})
