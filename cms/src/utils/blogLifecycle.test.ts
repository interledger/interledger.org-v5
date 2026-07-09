import { describe, expect, it } from 'vitest'
import { createBlogLifecycle, generateBlogMDX } from '@/utils'

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

describe('createBlogLifecycle — validate runs before the write, not after', () => {
  const lifecycle = createBlogLifecycle({
    outputDir: 'src/content/blog-posts'
  })

  it('beforeCreate throws when a bio is missing an author, before any DB write', () => {
    expect(() =>
      lifecycle.beforeCreate({
        params: { data: { articleBio: [{ author: null }] } }
      })
    ).toThrow('Author Bio: Name is required')
  })

  it('beforeUpdate throws when a related article is missing a slug, before any DB write', async () => {
    await expect(
      lifecycle.beforeUpdate({
        params: { data: { relatedArticles: [{ slug: '' }] } },
        state: {}
      })
    ).rejects.toThrow('Related Articles: Slug is required')
  })

  it('beforeCreate does not throw when bios and related articles are valid', () => {
    expect(() =>
      lifecycle.beforeCreate({
        params: {
          data: {
            articleBio: [{ author: 'Jane Doe' }],
            relatedArticles: [{ slug: 'other-post' }]
          }
        }
      })
    ).not.toThrow()
  })
})

describe('generateBlogMDX — article bios', () => {
  it('throws when a bio has a null author', () => {
    expect(() =>
      generateBlogMDX(makePost({ articleBio: [{ author: null }] }))
    ).toThrow('Author Bio: Name is required')
  })

  it('throws when a bio has an empty or whitespace-only author', () => {
    expect(() =>
      generateBlogMDX(makePost({ articleBio: [{ author: '' }] }))
    ).toThrow('Author Bio: Name is required')

    expect(() =>
      generateBlogMDX(makePost({ articleBio: [{ author: '   ' }] }))
    ).toThrow('Author Bio: Name is required')
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
})
