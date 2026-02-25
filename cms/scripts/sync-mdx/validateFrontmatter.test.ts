import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateFrontmatter, validateMdxFiles } from './validateFrontmatter'
import type { ContentTypeConfig } from './config'
import { createMdxFile } from './test-utils'

const pageSchema = z.object({
  title: z.string().min(1, 'title is required'),
  slug: z.string().min(1, 'slug is required'),
  description: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  sections: z.array(z.any()).optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

const foundationConfig: ContentTypeConfig = {
  dir: '',
  apiId: 'foundation-pages',
  schema: pageSchema,
  buildPayload: async () => ({})
}

const summitConfig: ContentTypeConfig = {
  dir: '',
  apiId: 'summit-pages',
  schema: pageSchema,
  buildPayload: async () => ({})
}

// Validates MDX frontmatter against Zod schemas before syncing to Strapi.
// Invalid files are skipped during sync to avoid corrupting CMS data.
describe('validateFrontmatter', () => {
  it('returns null for valid foundation-pages frontmatter', () => {
    const mdx = createMdxFile({
      filepath: '/content/about.mdx',
      slug: 'about-us',
      frontmatter: { title: 'About Us' }
    })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).toBeNull()
  })

  it('returns null for valid summit-pages frontmatter', () => {
    const mdx = createMdxFile({
      filepath: '/content/schedule.mdx',
      slug: 'schedule',
      frontmatter: { title: 'Schedule' }
    })

    const result = validateFrontmatter(summitConfig, mdx)

    expect(result).toBeNull()
  })

  it('returns error with filepath when title is missing', () => {
    const mdx = createMdxFile({
      filepath: '/content/invalid.mdx',
      slug: 'invalid'
    })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.filepath).toBe('/content/invalid.mdx')
  })

  it('returns error with slug from mdx file', () => {
    const mdx = createMdxFile({ slug: 'test-slug' })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.slug).toBe('test-slug')
  })

  it('returns error with locale from mdx file', () => {
    const mdx = createMdxFile({ locale: 'es' })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.locale).toBe('es')
  })

  it('returns error array with validation messages', () => {
    const mdx = createMdxFile({})

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.errors.length).toBeGreaterThan(0)
    expect(result!.errors.some((e) => e.toLowerCase().includes('title'))).toBe(
      true
    )
  })

  // Empty string is not the same as missing — Zod's min(1) catches both
  it('returns error when title is empty string', () => {
    const mdx = createMdxFile({ frontmatter: { title: '' } })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.errors.some((e) => e.toLowerCase().includes('title'))).toBe(
      true
    )
  })

  // Slug comes from MDX file metadata, not frontmatter, but we still validate it
  it('returns error when slug is empty in mdx file', () => {
    const mdx = createMdxFile({
      slug: '',
      frontmatter: { title: 'Valid Title' }
    })

    const result = validateFrontmatter(foundationConfig, mdx)

    expect(result).not.toBeNull()
    expect(result!.errors.some((e) => e.toLowerCase().includes('slug'))).toBe(
      true
    )
  })
})

// Batch validation helper that partitions files into valid/invalid arrays.
// Used at sync start to filter out bad files before processing.
describe('validateMdxFiles', () => {
  it('partitions files into valid and invalid arrays', () => {
    const files = [
      createMdxFile({
        filepath: '/content/good.mdx',
        slug: 'good',
        frontmatter: { title: 'Good' }
      }),
      createMdxFile({
        filepath: '/content/bad.mdx',
        slug: 'bad'
      })
    ]

    const { valid, invalid } = validateMdxFiles(foundationConfig, files)

    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(1)
  })

  it('places valid files in valid array', () => {
    const files = [
      createMdxFile({
        filepath: '/content/page1.mdx',
        slug: 'page1',
        frontmatter: { title: 'Page 1' }
      }),
      createMdxFile({
        filepath: '/content/page2.mdx',
        slug: 'page2',
        frontmatter: { title: 'Page 2' }
      })
    ]

    const { valid, invalid } = validateMdxFiles(foundationConfig, files)

    expect(valid).toHaveLength(2)
    expect(valid[0].slug).toBe('page1')
    expect(valid[1].slug).toBe('page2')
    expect(invalid).toHaveLength(0)
  })

  it('places invalid files in invalid array with error details', () => {
    const files = [
      createMdxFile({
        filepath: '/content/missing-title.mdx',
        slug: 'missing-title'
      })
    ]

    const { valid, invalid } = validateMdxFiles(foundationConfig, files)

    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].slug).toBe('missing-title')
    expect(invalid[0].errors.length).toBeGreaterThan(0)
  })

  it('returns empty arrays for empty input', () => {
    const { valid, invalid } = validateMdxFiles(foundationConfig, [])

    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })

  // Validation is per-file, not per-locale — a Spanish file can fail
  // while English and German files pass
  it('handles mixed valid and invalid files across locales', () => {
    const files = [
      createMdxFile({
        filepath: '/content/en/page.mdx',
        slug: 'page',
        frontmatter: { title: 'English Page' }
      }),
      createMdxFile({
        filepath: '/content/es/page.mdx',
        slug: 'pagina',
        locale: 'es'
      }),
      createMdxFile({
        filepath: '/content/de/page.mdx',
        slug: 'seite',
        locale: 'de',
        frontmatter: { title: 'Deutsche Seite' }
      })
    ]

    const { valid, invalid } = validateMdxFiles(foundationConfig, files)

    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].locale).toBe('es')
  })
})
