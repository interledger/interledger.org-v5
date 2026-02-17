import { describe, expect, test } from 'bun:test'
import { validateFrontmatter, validateMdxFiles } from './validateFrontmatter'
import type { MDXFile } from './scan'

function createMDXFile(overrides: Partial<MDXFile> = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/path/test.mdx',
    slug: 'test-slug',
    locale: 'en',
    frontmatter: { title: 'Test', slug: 'test-slug' },
    content: '',
    isLocalization: false,
    localizes: null,
    ...overrides
  }
}

describe('validateFrontmatter', () => {
  const validCases: Array<{ desc: string; contentType: string; mdx: MDXFile }> = [
    {
      desc: 'foundation-pages valid',
      contentType: 'foundation-pages',
      mdx: createMDXFile({ slug: 'about-us', frontmatter: { title: 'About', slug: 'about-us' } })
    },
    {
      desc: 'summit-pages valid',
      contentType: 'summit-pages',
      mdx: createMDXFile({ slug: 'schedule', frontmatter: { title: 'Schedule', slug: 'schedule' } })
    },
    {
      desc: 'with optional hero fields',
      contentType: 'foundation-pages',
      mdx: createMDXFile({
        frontmatter: { title: 'Page', slug: 'page', heroTitle: 'Hero', heroDescription: 'Desc' }
      })
    }
  ]
  for (const { desc, contentType, mdx } of validCases) {
    test(desc, () => {
      expect(validateFrontmatter(contentType as any, mdx)).toBeNull()
    })
  }

  const invalidCases: Array<{
    desc: string
    contentType: string
    mdx: MDXFile
    expectedInErrors?: string
  }> = [
    {
      desc: 'missing title',
      contentType: 'foundation-pages',
      mdx: createMDXFile({ frontmatter: { slug: 'about' } }),
      expectedInErrors: 'title'
    },
    {
      desc: 'empty title',
      contentType: 'foundation-pages',
      mdx: createMDXFile({ frontmatter: { title: '', slug: 'about' } }),
      expectedInErrors: 'title'
    },
    {
      desc: 'missing slug',
      contentType: 'foundation-pages',
      mdx: createMDXFile({ slug: '', frontmatter: { title: 'About' } }),
      expectedInErrors: 'slug'
    },
    {
      desc: 'unknown contentType returns null (no schema)',
      contentType: 'blog-posts',
      mdx: createMDXFile()
    }
  ]
  for (const { desc, contentType, mdx, expectedInErrors } of invalidCases) {
    test(desc, () => {
      const result = validateFrontmatter(contentType as any, mdx)
      if (contentType === 'blog-posts') {
        expect(result).toBeNull()
        return
      }
      expect(result).not.toBeNull()
      expect(result!.errors.length).toBeGreaterThan(0)
      if (expectedInErrors) {
        expect(result!.errors.some((e) => e.toLowerCase().includes(expectedInErrors))).toBe(true)
      }
    })
  }
})

describe('validateMdxFiles', () => {
  test('splits valid and invalid', () => {
    const files: MDXFile[] = [
      createMDXFile({ slug: 'good', frontmatter: { title: 'Good', slug: 'good' } }),
      createMDXFile({ slug: 'bad', frontmatter: { slug: 'bad' } })
    ]
    const { valid, invalid } = validateMdxFiles('foundation-pages', files)
    expect(valid).toHaveLength(1)
    expect(valid[0].slug).toBe('good')
    expect(invalid).toHaveLength(1)
    expect(invalid[0].slug).toBe('bad')
  })
})
