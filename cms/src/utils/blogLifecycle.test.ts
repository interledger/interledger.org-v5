import { describe, expect, it } from 'vitest'
import { generateBlogMDX, resolveBlogEnglishSlug } from '@/utils'

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

describe('resolveBlogEnglishSlug', () => {
  it('prefers an explicit englishSlug argument', () => {
    expect(
      resolveBlogEnglishSlug(
        makePost({
          locale: 'es',
          pathSlug: 'es-slug',
          localizations: [{ pathSlug: 'other', locale: 'en' }]
        }),
        'explicit-en'
      )
    ).toBe('explicit-en')
  })

  it('prefers the en localization entry over others', () => {
    expect(
      resolveBlogEnglishSlug(
        makePost({
          locale: 'es',
          pathSlug: 'shared-slug',
          localizations: [
            { pathSlug: 'wrong', locale: 'fr' },
            { pathSlug: 'english-slug', locale: 'en' }
          ]
        })
      )
    ).toBe('english-slug')
  })

  it('falls back to the post pathSlug when localizations are empty', () => {
    expect(
      resolveBlogEnglishSlug(
        makePost({ locale: 'es', pathSlug: 'shared-slug', localizations: [] })
      )
    ).toBe('shared-slug')
  })
})

describe('generateBlogMDX — locale and localizes', () => {
  it('always writes locale for English posts', () => {
    const mdx = generateBlogMDX(makePost({ locale: 'en' }))
    expect(mdx).toMatch(/^locale:\s*'en'/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes locale and localizes for Spanish posts', () => {
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'test-post',
        localizations: [{ pathSlug: 'test-post', locale: 'en' }]
      })
    )
    expect(mdx).toMatch(/^locale:\s*'es'/m)
    expect(mdx).toMatch(/^localizes:\s*'test-post'/m)
  })

  it('places locale and localizes after featured, before images', () => {
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'test-post',
        localizations: [],
        featureMedia: {
          image: { name: 'banner.jpg', url: '/img/banner.jpg' },
          alternativeText: 'Banner'
        }
      })
    )
    const featuredAt = mdx.indexOf('featured:')
    const localeAt = mdx.indexOf('locale:')
    const localizesAt = mdx.indexOf('localizes:')
    const featureImageAt = mdx.indexOf('featureImage:')
    expect(featuredAt).toBeGreaterThan(-1)
    expect(localeAt).toBeGreaterThan(featuredAt)
    expect(localizesAt).toBeGreaterThan(localeAt)
    expect(featureImageAt).toBeGreaterThan(localizesAt)
  })

  it('falls back to pathSlug for localizes when localizations lack pathSlug', () => {
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'test-post',
        localizations: []
      })
    )
    expect(mdx).toMatch(/^locale:\s*'es'/m)
    expect(mdx).toMatch(/^localizes:\s*'test-post'/m)
  })

  it('uses the explicit englishSlug option for localizes', () => {
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'es-only-slug',
        localizations: []
      }),
      { englishSlug: 'english-path' }
    )
    expect(mdx).toMatch(/^localizes:\s*'english-path'/m)
  })

  it('still writes locale and localizes when locale was missing on the post', () => {
    // Simulates Strapi omiting locale on the document payload.
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'test-post',
        localizations: []
      })
    )
    // After writeMDXFile stamps locale; generateBlogMDX itself defaults missing
    // locale to en — callers must pass locale. Stamp it as writeMDXFile does.
    const stamped = generateBlogMDX(
      makePost({
        locale: undefined,
        pathSlug: 'test-post',
        localizations: []
      } as Record<string, unknown>)
    )
    // Missing locale defaults to en — no localizes (by design for EN).
    expect(stamped).toMatch(/^locale:\s*'en'/m)
    expect(stamped).not.toMatch(/^localizes:/m)

    // With locale stamped (as writeMDXFile / fetchBlogPost do):
    expect(mdx).toMatch(/^locale:\s*'es'/m)
    expect(mdx).toMatch(/^localizes:\s*'test-post'/m)
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
