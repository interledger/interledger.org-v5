import { describe, expect, it } from 'vitest'
import { generateBlogMDX } from '@/utils'

// Minimal BlogResult factory — only the fields generateBlogMDX reads matter.
// Cast through unknown because the test deliberately omits Strapi-only fields.
function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    documentId: 'doc1',
    title: 'Test post',
    description: 'A test description',
    pathSlug: 'test-post',
    date: '2026-06-10',
    featured: false,
    content: 'Body content.',
    createdAt: new Date('2026-06-10'),
    updatedAt: new Date('2026-06-10'),
    locale: 'en',
    categories: [],
    localizations: [],
    ...overrides
  } as unknown as Parameters<typeof generateBlogMDX>[0]
}

describe('generateBlogMDX — article bios', () => {
  it('omits articleBios entirely when a bio has a null author (INTORG-794)', () => {
    const mdx = generateBlogMDX(makePost({ articleBio: [{ author: null }] }))

    expect(mdx).not.toContain('articleBios')
    expect(mdx).not.toContain('author: null')
  })

  it('skips bios with empty or whitespace-only authors', () => {
    const mdx = generateBlogMDX(
      makePost({ articleBio: [{ author: '' }, { author: '   ' }] })
    )

    expect(mdx).not.toContain('articleBios')
  })

  it('serializes valid bios with author and link', () => {
    const mdx = generateBlogMDX(
      makePost({
        articleBio: [{ author: 'Jane Doe', link: 'https://example.com' }]
      })
    )

    expect(mdx).toContain('articleBios:')
    expect(mdx).toContain("- author: 'Jane Doe'")
    expect(mdx).toContain("link: 'https://example.com'")
  })

  it('keeps valid bios and drops empty ones in a mixed list', () => {
    const mdx = generateBlogMDX(
      makePost({
        articleBio: [{ author: null }, { author: 'Jane Doe' }, { author: '' }]
      })
    )

    expect(mdx).toContain("- author: 'Jane Doe'")
    expect(mdx).not.toContain('author: null')
    // Only one bio entry survives.
    expect(mdx.match(/- author:/g)).toHaveLength(1)
  })
})

describe('generateBlogMDX — footer note', () => {
  it('emits footerNote as a YAML literal block when present (INTORG-838)', () => {
    const mdx = generateBlogMDX(
      makePost({
        footerNote:
          'This article was originally published at [medium.com](https://medium.com/x).'
      })
    )

    expect(mdx).toContain('footerNote: |')
    expect(mdx).toContain(
      'This article was originally published at [medium.com](https://medium.com/x).'
    )
  })

  it('omits footerNote when absent', () => {
    const mdx = generateBlogMDX(makePost())

    expect(mdx).not.toContain('footerNote')
  })

  it('omits footerNote when empty', () => {
    const mdx = generateBlogMDX(makePost({ footerNote: '' }))

    expect(mdx).not.toContain('footerNote')
  })

  it('preserves multi-line markdown in the footer note', () => {
    const mdx = generateBlogMDX(
      makePost({ footerNote: 'Line one.\n\nLine two.' })
    )

    expect(mdx).toContain('footerNote: |')
    expect(mdx).toContain('Line one.')
    expect(mdx).toContain('Line two.')
  })
})
