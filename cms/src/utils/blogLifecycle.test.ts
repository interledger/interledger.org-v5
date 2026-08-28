import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import {
  generateBlogMDX,
  resolveBlogEnglishSlug,
  resolveBlogMdxFilename,
  stampBlogLocale
} from '@/utils'

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

describe('stampBlogLocale', () => {
  it('keeps a present locale from the document', () => {
    expect(stampBlogLocale({ locale: 'es' }, 'en')).toBe('es')
  })

  it('uses the requested locale when the document omits locale', () => {
    // Regression: Strapi sometimes returns ES documents without locale set.
    // Without this stamp, export defaulted to en and dropped localizes.
    expect(stampBlogLocale({ locale: undefined }, 'es')).toBe('es')
    expect(stampBlogLocale({ locale: null }, 'es')).toBe('es')
    expect(stampBlogLocale({ locale: '   ' }, 'es')).toBe('es')
  })

  it('trusts a reported locale that differs from the request (no overwrite)', () => {
    // e.g. asked for es but i18n fell back to the EN document
    expect(stampBlogLocale({ locale: 'en' }, 'es')).toBe('en')
  })

  it('falls back to defaultLang when both are empty', () => {
    expect(stampBlogLocale({ locale: undefined }, '')).toBe('en')
  })
})

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

  it('returns undefined when no EN counterpart is known', () => {
    // Must not invent localizes from the ES pathSlug alone.
    expect(
      resolveBlogEnglishSlug(
        makePost({ locale: 'es', pathSlug: 'es-only-slug', localizations: [] })
      )
    ).toBeUndefined()
  })

  it('ignores non-en localization entries (not a real EN counterpart)', () => {
    expect(
      resolveBlogEnglishSlug(
        makePost({
          locale: 'es',
          pathSlug: 'es-slug',
          localizations: [{ pathSlug: 'fr-slug', locale: 'fr' }]
        })
      )
    ).toBeUndefined()
  })
})

describe('resolveBlogMdxFilename — write/delete path parity', () => {
  it('uses the English slug for Spanish filenames when pathSlugs differ', () => {
    // Mirrors the afterDelete bug: lifecycle result has no localizations, so
    // the englishSlug must come from a separate EN fetch (passed explicitly).
    expect(
      resolveBlogMdxFilename(
        {
          locale: 'es',
          pathSlug: 'es-slug',
          date: '2026-06-10',
          localizations: []
        },
        'en-slug'
      )
    ).toBe('2026-06-10-en-slug.mdx')
  })

  it('does not fall back to localizations[0] when that entry is not EN', () => {
    // Old delete path used localizations[0]?.pathSlug, which can be wrong.
    expect(
      resolveBlogMdxFilename(
        {
          locale: 'es',
          pathSlug: 'es-slug',
          date: '2026-06-10',
          localizations: [{ pathSlug: 'wrong-first', locale: 'fr' }]
        },
        'en-slug'
      )
    ).toBe('2026-06-10-en-slug.mdx')
  })

  it('defaults missing locale to en so delete does not aim at the wrong tree', () => {
    // getOutputPath(undefined) hits the EN root; filename must still use own slug.
    expect(
      resolveBlogMdxFilename(
        {
          locale: undefined,
          pathSlug: 'en-slug',
          date: '2026-06-10',
          localizations: []
        },
        undefined
      )
    ).toBe('2026-06-10-en-slug.mdx')
  })

  it('uses own pathSlug for English filenames', () => {
    expect(
      resolveBlogMdxFilename(
        {
          locale: 'en',
          pathSlug: 'en-slug',
          date: '2026-06-10',
          localizations: []
        },
        'ignored-for-en'
      )
    ).toBe('2026-06-10-en-slug.mdx')
  })
})

describe('generateBlogMDX — locale and localizes', () => {
  it('always writes locale for English posts', () => {
    const mdx = generateBlogMDX(makePost({ locale: 'en' }))
    expect(mdx).toMatch(/^locale:\s*en$/m)
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
    // Bare YAML (no quotes) — matches checked-in blog MDX / pathSlug style.
    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).toMatch(/^localizes:\s*test-post$/m)
  })

  it('places locale and localizes after featured, before images', () => {
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'test-post',
        localizations: [{ pathSlug: 'test-post', locale: 'en' }],
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

  it('omits localizes when no EN counterpart is known', () => {
    // ES-only post: enPost null, empty localizations. Writing localizes:
    // <es-pathSlug> would be a lie and make sync-mdx/translationMap invent EN.
    const mdx = generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'es-only-slug',
        localizations: []
      })
    )
    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
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
    expect(mdx).toMatch(/^localizes:\s*english-path$/m)
  })

  it('defaults missing locale to en; callers must stamp locale for localized exports', () => {
    // Simulates Strapi omitting locale on the document payload.
    // generateBlogMDX itself defaults missing locale to en — no localizes.
    // Callers (fetchBlogPost / writeMDXFile) must stamp the requested locale
    // before generating ES frontmatter.
    const mdx = generateBlogMDX(
      makePost({
        locale: undefined,
        pathSlug: 'test-post',
        localizations: []
      } as Record<string, unknown>)
    )
    expect(mdx).toMatch(/^locale:\s*en$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes locale after stamping a missing document locale as es', () => {
    // Strapi omitted locale on the document; fetchBlogPost stamps the
    // requested locale before generateBlogMDX runs. Without an EN counterpart
    // we still write locale, but not a fabricated localizes.
    const postFromStrapi = makePost({
      locale: undefined,
      pathSlug: 'test-post',
      localizations: []
    } as Record<string, unknown>)
    const locale = stampBlogLocale(postFromStrapi, 'es')
    const mdx = generateBlogMDX({ ...postFromStrapi, locale })

    expect(locale).toBe('es')
    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes localizes when EN is known only via the englishSlug option', () => {
    const postFromStrapi = makePost({
      locale: undefined,
      pathSlug: 'es-slug',
      localizations: []
    } as Record<string, unknown>)
    const locale = stampBlogLocale(postFromStrapi, 'es')
    const mdx = generateBlogMDX(
      { ...postFromStrapi, locale },
      { englishSlug: 'en-slug' }
    )

    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).toMatch(/^localizes:\s*en-slug$/m)
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

  it('promotes a stray <br/> in profileBio to a paragraph break', () => {
    const mdx = generateBlogMDX(
      makePost({
        articleBio: [
          { author: 'Jane Doe', profileBio: 'line one<br/>line two' }
        ]
      })
    )

    const parsed = matter(mdx)

    // YAML literal block scalars (`|`) always retain a trailing newline.
    expect(parsed.data.articleBios[0].text).toBe('line one\n\nline two\n')
  })
})
