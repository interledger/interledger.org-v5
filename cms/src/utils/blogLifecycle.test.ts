import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBlogLifecycle,
  findMovedBlogFiles,
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
  it('always writes locale for English posts', async () => {
    const mdx = await generateBlogMDX(makePost({ locale: 'en' }))
    expect(mdx).toMatch(/^locale:\s*en$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes locale and localizes for Spanish posts', async () => {
    const mdx = await generateBlogMDX(
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

  it('places locale and localizes after featured, before images', async () => {
    const mdx = await generateBlogMDX(
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

  it('omits localizes when no EN counterpart is known', async () => {
    // ES-only post: enPost null, empty localizations. Writing localizes:
    // <es-pathSlug> would be a lie and make sync-mdx/translationMap invent EN.
    const mdx = await generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'es-only-slug',
        localizations: []
      })
    )
    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('uses the explicit englishSlug option for localizes', async () => {
    const mdx = await generateBlogMDX(
      makePost({
        locale: 'es',
        pathSlug: 'es-only-slug',
        localizations: []
      }),
      { englishSlug: 'english-path' }
    )
    expect(mdx).toMatch(/^localizes:\s*english-path$/m)
  })

  it('defaults missing locale to en; callers must stamp locale for localized exports', async () => {
    // Simulates Strapi omitting locale on the document payload.
    // generateBlogMDX itself defaults missing locale to en — no localizes.
    // Callers (fetchBlogPost / writeMDXFile) must stamp the requested locale
    // before generating ES frontmatter.
    const mdx = await generateBlogMDX(
      makePost({
        locale: undefined,
        pathSlug: 'test-post',
        localizations: []
      } as Record<string, unknown>)
    )
    expect(mdx).toMatch(/^locale:\s*en$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes locale after stamping a missing document locale as es', async () => {
    // Strapi omitted locale on the document; fetchBlogPost stamps the
    // requested locale before generateBlogMDX runs. Without an EN counterpart
    // we still write locale, but not a fabricated localizes.
    const postFromStrapi = makePost({
      locale: undefined,
      pathSlug: 'test-post',
      localizations: []
    } as Record<string, unknown>)
    const locale = stampBlogLocale(postFromStrapi, 'es')
    const mdx = await generateBlogMDX({ ...postFromStrapi, locale })

    expect(locale).toBe('es')
    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).not.toMatch(/^localizes:/m)
  })

  it('writes localizes when EN is known only via the englishSlug option', async () => {
    const postFromStrapi = makePost({
      locale: undefined,
      pathSlug: 'es-slug',
      localizations: []
    } as Record<string, unknown>)
    const locale = stampBlogLocale(postFromStrapi, 'es')
    const mdx = await generateBlogMDX(
      { ...postFromStrapi, locale },
      { englishSlug: 'en-slug' }
    )

    expect(mdx).toMatch(/^locale:\s*es$/m)
    expect(mdx).toMatch(/^localizes:\s*en-slug$/m)
  })
})

describe('generateBlogMDX — article bios', () => {
  it('throws when a bio has a null author', async () => {
    await expect(
      generateBlogMDX(makePost({ articleBio: [{ author: null }] }))
    ).rejects.toThrow('Author Bio: Name is required')
  })

  it('throws when a bio has an empty or whitespace-only author', async () => {
    await expect(
      generateBlogMDX(makePost({ articleBio: [{ author: '' }] }))
    ).rejects.toThrow('Author Bio: Name is required')

    await expect(
      generateBlogMDX(makePost({ articleBio: [{ author: '   ' }] }))
    ).rejects.toThrow('Author Bio: Name is required')
  })

  it('serializes valid bios with author and link', async () => {
    const mdx = await generateBlogMDX(
      makePost({
        articleBio: [{ author: 'Jane Doe', link: 'https://example.com' }]
      })
    )

    expect(mdx).toContain('articleBios:')
    expect(mdx).toContain("- author: 'Jane Doe'")
    expect(mdx).toContain("link: 'https://example.com'")
  })

  it('promotes a stray <br/> in profileBio to a paragraph break', async () => {
    const mdx = await generateBlogMDX(
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

describe('generateBlogMDX — draft', () => {
  it('writes draft: true when the box is checked', async () => {
    const mdx = await generateBlogMDX(makePost({ draft: true }))

    expect(matter(mdx).data.draft).toBe(true)
  })

  it.each([false, null, undefined])(
    'omits draft when the value is %s',
    async (draft) => {
      const mdx = await generateBlogMDX(makePost({ draft }))

      expect(mdx).not.toMatch(/^draft:/m)
    }
  )
})

describe('findMovedBlogFiles', () => {
  it('returns each locale whose path changed', () => {
    expect(
      findMovedBlogFiles(
        { en: 'a/2026-01-01-old.mdx', es: 'a/es/2026-01-01-old.mdx' },
        { en: 'a/2026-01-01-new.mdx', es: 'a/es/2026-01-01-new.mdx' }
      )
    ).toEqual([
      { locale: 'en', oldFilepath: 'a/2026-01-01-old.mdx' },
      { locale: 'es', oldFilepath: 'a/es/2026-01-01-old.mdx' }
    ])
  })

  it('returns nothing when no path changed', () => {
    const paths = { en: 'a/2026-01-01-post.mdx' }
    expect(findMovedBlogFiles(paths, { ...paths })).toEqual([])
  })

  it('keeps a locale that could not be read after the update', () => {
    expect(findMovedBlogFiles({ es: 'a/es/2026-01-01-post.mdx' }, {})).toEqual(
      []
    )
  })
})

// INTORG-1392: on Strapi 5.57 a rename left the old file behind, and the next
// sync imported it as a second post. The events below carry only `where.id`,
// as 5.57 sends them.
describe('createBlogLifecycle — slug and date changes', () => {
  const outputDir = 'src/content/foundation-blog-posts'
  let repoRoot: string
  let posts: Record<string, Record<string, unknown>>

  function blogFile(locale: string, name: string): string {
    const dir =
      locale === 'en'
        ? path.join(repoRoot, outputDir)
        : path.join(repoRoot, outputDir, locale)
    return path.join(dir, `${name}.mdx`)
  }

  function seedFile(locale: string, name: string): string {
    const filepath = blogFile(locale, name)
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, '---\n---\n')
    return filepath
  }

  function stubStrapi(savedLocale: string) {
    vi.stubGlobal('strapi', {
      requestContext: { get: () => ({ request: { headers: {} } }) },
      db: {
        query: () => ({
          findOne: async () => ({ documentId: 'doc1', locale: savedLocale })
        })
      },
      documents: () => ({
        findOne: async ({ locale }: { locale: string }) =>
          posts[locale] ? { ...posts[locale] } : null
      })
    })
  }

  /** Run one admin save of `locale` through both update hooks. */
  async function save(locale: string, changes: Record<string, unknown>) {
    stubStrapi(locale)
    const lifecycle = createBlogLifecycle({ outputDir })
    const state = {}
    await lifecycle.beforeUpdate({
      params: { where: { id: 7 }, data: {} },
      state
    })
    posts[locale] = { ...posts[locale], ...changes }
    await lifecycle.afterUpdate({
      model: { singularName: 'foundation-blog-post' },
      result: posts[locale],
      state
    } as unknown as Parameters<typeof lifecycle.afterUpdate>[0])
  }

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-rename-'))
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', repoRoot)
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const shared = {
      documentId: 'doc1',
      description: 'A test description',
      date: '2025-06-11',
      featured: false,
      content: 'Body content.',
      publishedAt: new Date('2025-06-11'),
      localizations: []
    }
    posts = {
      en: { ...shared, title: 'Post', pathSlug: 'test', locale: 'en' },
      es: { ...shared, title: 'Entrada', pathSlug: 'prueba', locale: 'es' }
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fs.rmSync(repoRoot, { recursive: true, force: true })
  })

  it('moves every locale file when the English slug changes', async () => {
    const oldEn = seedFile('en', '2025-06-11-test')
    const oldEs = seedFile('es', '2025-06-11-test')

    await save('en', { pathSlug: 'test-change-slug' })

    expect(fs.existsSync(oldEn)).toBe(false)
    expect(fs.existsSync(oldEs)).toBe(false)
    expect(fs.existsSync(blogFile('en', '2025-06-11-test-change-slug'))).toBe(
      true
    )
    expect(fs.existsSync(blogFile('es', '2025-06-11-test-change-slug'))).toBe(
      true
    )
  })

  it('moves the English file when the English date changes', async () => {
    const oldEn = seedFile('en', '2025-06-11-test')

    await save('en', { date: '2025-07-01' })

    expect(fs.existsSync(oldEn)).toBe(false)
    expect(fs.existsSync(blogFile('en', '2025-07-01-test'))).toBe(true)
  })

  // Each locale's filename takes its own date, so the old cleanup, which
  // looked only at the English date, missed this one.
  it('moves only the Spanish file when only the Spanish date changes', async () => {
    const en = seedFile('en', '2025-06-11-test')
    const oldEs = seedFile('es', '2025-06-11-test')

    await save('es', { date: '2025-07-01' })

    expect(fs.existsSync(oldEs)).toBe(false)
    expect(fs.existsSync(blogFile('es', '2025-07-01-test'))).toBe(true)
    expect(fs.existsSync(en)).toBe(true)
  })

  it('rewrites the file in place when neither slug nor date changes', async () => {
    const en = seedFile('en', '2025-06-11-test')

    await save('en', { title: 'Renamed title' })

    expect(fs.readFileSync(en, 'utf-8')).toContain('Renamed title')
    expect(fs.readdirSync(path.dirname(en))).toEqual(['2025-06-11-test.mdx'])
  })
})
