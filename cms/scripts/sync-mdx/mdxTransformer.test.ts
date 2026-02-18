import { describe, expect, test } from 'bun:test'
import { getEntryField, isPageType, mdxToStrapiPayload } from './mdxTransformer'
import type { StrapiEntry } from './strapiClient'
import type { MDXFile } from './scan'

function createMDXFile(overrides: Partial<MDXFile> = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/test.mdx',
    slug: 'test-page',
    locale: 'en',
    frontmatter: { title: 'Test', slug: 'test-page' },
    content: 'Hello world',
    isLocalization: false,
    localizes: null,
    ...overrides
  }
}

describe('getEntryField', () => {
  const cases: Array<{
    desc: string
    entry: StrapiEntry | null
    key: string
    expected: unknown
  }> = [
    {
      desc: 'null entry returns null',
      entry: null,
      key: 'title',
      expected: null
    },
    {
      desc: 'flat Strapi v5 field on root',
      entry: { documentId: '1', slug: 'test', title: 'My Title' },
      key: 'title',
      expected: 'My Title'
    },
    {
      desc: 'missing key returns null',
      entry: { documentId: '1', slug: 'test' },
      key: 'hero',
      expected: null
    }
  ]
  for (const { desc, entry, key, expected } of cases) {
    test(desc, () => {
      expect(getEntryField(entry, key)).toEqual(expected)
    })
  }
})

describe('isPageType', () => {
  const cases: Array<{ input: string; expected: boolean }> = [
    { input: 'foundation-pages', expected: true },
    { input: 'summit-pages', expected: true },
    { input: 'blog-posts', expected: false },
    { input: 'unknown', expected: false }
  ]
  for (const { input, expected } of cases) {
    test(`${input} -> ${expected}`, () => {
      expect(isPageType(input as any)).toBe(expected)
    })
  }
})

describe('mdxToStrapiPayload', () => {
  test('throws for non-page content type', () => {
    const mdx = createMDXFile()
    expect(() => mdxToStrapiPayload('blog-posts' as any, mdx)).toThrow(
      'Unsupported content type'
    )
  })

  test('foundation-pages: minimal required fields', () => {
    const mdx = createMDXFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' },
      content: ''
    })
    const payload = mdxToStrapiPayload('foundation-pages', mdx, null)
    expect(payload.title).toBe('About')
    expect(payload.slug).toBe('about')
    expect(payload.publishedAt).toBeDefined()
  })

  test('preserves existing hero when MDX has no hero', () => {
    const existing: StrapiEntry = {
      documentId: '1',
      slug: 'about',
      hero: { title: 'Old Hero', description: 'Kept' }
    }
    const mdx = createMDXFile({
      frontmatter: { title: 'About', slug: 'about' },
      content: ''
    })
    const payload = mdxToStrapiPayload('foundation-pages', mdx, existing)
    expect(payload.hero).toEqual({ title: 'Old Hero', description: 'Kept' })
  })

  test('overrides hero when MDX has heroTitle/heroDescription', () => {
    const mdx = createMDXFile({
      frontmatter: {
        title: 'About',
        slug: 'about',
        heroTitle: 'New Hero',
        heroDescription: 'New desc'
      },
      content: ''
    })
    const payload = mdxToStrapiPayload('foundation-pages', mdx, null)
    expect(payload.hero).toEqual({ title: 'New Hero', description: 'New desc' })
  })

  test('preserves existing content when MDX body empty', () => {
    const existing: StrapiEntry = {
      documentId: '1',
      slug: 'about',
      content: [{ __component: 'blocks.paragraph', content: 'Existing' }]
    }
    const mdx = createMDXFile({
      frontmatter: { title: 'About', slug: 'about' },
      content: ''
    })
    const payload = mdxToStrapiPayload('foundation-pages', mdx, existing)
    expect(payload.content).toEqual([
      { __component: 'blocks.paragraph', content: 'Existing' }
    ])
  })

  test('stores markdown as-is when MDX has body', () => {
    const mdx = createMDXFile({
      frontmatter: { title: 'About', slug: 'about' },
      content: '## Heading\n\nParagraph **bold**'
    })
    const payload = mdxToStrapiPayload('foundation-pages', mdx, null)
    expect(payload.content).toEqual([
      {
        __component: 'blocks.paragraph',
        content: '## Heading\n\nParagraph **bold**'
      }
    ])
  })

  test('throws on invalid schema (missing title)', () => {
    const mdx = createMDXFile({
      frontmatter: { slug: 'about' },
      content: ''
    })
    expect(() => mdxToStrapiPayload('foundation-pages', mdx, null)).toThrow()
  })
})
