import { describe, it, expect } from 'vitest'
import { validateFrontmatter, validateMdxFiles } from './validateFrontmatter'
import type { MDXFile } from './scan'

// Validates MDX frontmatter against Zod schemas before syncing to Strapi.
// Invalid files are skipped during sync to avoid corrupting CMS data.
describe('validateFrontmatter', () => {
  it('returns null for valid foundation-pages frontmatter', () => {
    const mdx = {
      filepath: '/content/about.mdx',
      slug: 'about-us',
      locale: 'en',
      frontmatter: { title: 'About Us' }
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).toBeNull()
  })

  it('returns null for valid summit-pages frontmatter', () => {
    const mdx = {
      filepath: '/content/schedule.mdx',
      slug: 'schedule',
      locale: 'en',
      frontmatter: { title: 'Schedule' }
    } as unknown as MDXFile

    const result = validateFrontmatter('summit-pages', mdx)

    expect(result).toBeNull()
  })

  it('returns error with filepath when title is missing', () => {
    const mdx = {
      filepath: '/content/invalid.mdx',
      slug: 'invalid',
      locale: 'en',
      frontmatter: {}
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).not.toBeNull()
    expect(result!.filepath).toBe('/content/invalid.mdx')
  })

  it('returns error with slug from mdx file', () => {
    const mdx = {
      filepath: '/content/test.mdx',
      slug: 'test-slug',
      locale: 'en',
      frontmatter: {}
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).not.toBeNull()
    expect(result!.slug).toBe('test-slug')
  })

  it('returns error with locale from mdx file', () => {
    const mdx = {
      filepath: '/content/test.mdx',
      slug: 'test',
      locale: 'es',
      frontmatter: {}
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).not.toBeNull()
    expect(result!.locale).toBe('es')
  })

  it('returns error array with validation messages', () => {
    const mdx = {
      filepath: '/content/test.mdx',
      slug: 'test',
      locale: 'en',
      frontmatter: {}
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).not.toBeNull()
    expect(result!.errors.length).toBeGreaterThan(0)
    expect(result!.errors.some((e) => e.toLowerCase().includes('title'))).toBe(
      true
    )
  })

  // Empty string is not the same as missing — Zod's min(1) catches both
  it('returns error when title is empty string', () => {
    const mdx = {
      filepath: '/content/test.mdx',
      slug: 'test',
      locale: 'en',
      frontmatter: { title: '' }
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

    expect(result).not.toBeNull()
    expect(result!.errors.some((e) => e.toLowerCase().includes('title'))).toBe(
      true
    )
  })

  // Slug comes from MDX file metadata, not frontmatter, but we still validate it
  it('returns error when slug is empty in mdx file', () => {
    const mdx = {
      filepath: '/content/test.mdx',
      slug: '',
      locale: 'en',
      frontmatter: { title: 'Valid Title' }
    } as unknown as MDXFile

    const result = validateFrontmatter('foundation-pages', mdx)

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
      {
        filepath: '/content/good.mdx',
        slug: 'good',
        locale: 'en',
        frontmatter: { title: 'Good' }
      },
      {
        filepath: '/content/bad.mdx',
        slug: 'bad',
        locale: 'en',
        frontmatter: {}
      }
    ] as unknown as MDXFile[]

    const { valid, invalid } = validateMdxFiles('foundation-pages', files)

    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(1)
  })

  it('places valid files in valid array', () => {
    const files = [
      {
        filepath: '/content/page1.mdx',
        slug: 'page1',
        locale: 'en',
        frontmatter: { title: 'Page 1' }
      },
      {
        filepath: '/content/page2.mdx',
        slug: 'page2',
        locale: 'en',
        frontmatter: { title: 'Page 2' }
      }
    ] as unknown as MDXFile[]

    const { valid, invalid } = validateMdxFiles('foundation-pages', files)

    expect(valid).toHaveLength(2)
    expect(valid[0].slug).toBe('page1')
    expect(valid[1].slug).toBe('page2')
    expect(invalid).toHaveLength(0)
  })

  it('places invalid files in invalid array with error details', () => {
    const files = [
      {
        filepath: '/content/missing-title.mdx',
        slug: 'missing-title',
        locale: 'en',
        frontmatter: {}
      }
    ] as unknown as MDXFile[]

    const { valid, invalid } = validateMdxFiles('foundation-pages', files)

    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].slug).toBe('missing-title')
    expect(invalid[0].errors.length).toBeGreaterThan(0)
  })

  it('returns empty arrays for empty input', () => {
    const { valid, invalid } = validateMdxFiles('foundation-pages', [])

    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })

  // Validation is per-file, not per-locale — a Spanish file can fail
  // while English and German files pass
  it('handles mixed valid and invalid files across locales', () => {
    const files = [
      {
        filepath: '/content/en/page.mdx',
        slug: 'page',
        locale: 'en',
        frontmatter: { title: 'English Page' }
      },
      {
        filepath: '/content/es/page.mdx',
        slug: 'pagina',
        locale: 'es',
        frontmatter: {}
      },
      {
        filepath: '/content/de/page.mdx',
        slug: 'seite',
        locale: 'de',
        frontmatter: { title: 'Deutsche Seite' }
      }
    ] as unknown as MDXFile[]

    const { valid, invalid } = validateMdxFiles('foundation-pages', files)

    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].locale).toBe('es')
  })
})
