import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionEntry } from 'astro:content'

// `./blogSearch` -> `./i18` -> `./locales` reaches into Astro's virtual modules
// for i18n config, and the module itself calls the `astro:content`
// getCollection export directly — mock both (same convention as
// podcastPagination.test.ts / breadcrumbs.test.ts).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
// Defaults to `[]` because `./i18` -> `./translatePath` -> `./translationMapData`
// awaits buildMap() at module load, which calls getCollection for every
// collection before any test body runs.
const getCollectionMock = vi.fn().mockResolvedValue([])
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: getCollectionMock }
})

const { getBlogSearchIndex } = await import('./blogSearch')
const { setPublishGateForTests } = await import('./blogPosts')
const {
  setImageCdnEnabledForTests,
  setDeployedImageSourcesForTests,
  setOptimizedImageVariantCatalogForTests
} = await import('./images')

type Entry = CollectionEntry<'foundation-blog'>

interface FakePost {
  slug: string
  date: string
  title?: string
  description?: string
  categories?: string[]
  locale?: string
  body?: string
  thumbnailImage?: string
  featureImage?: string
  featureImageAlt?: string
  featureImageBlur?: string
  legacy?: boolean
}

// Minimal stand-in for a content collection entry; only the fields
// getBlogSearchIndex reads are populated.
function makePost(post: FakePost): Entry {
  return {
    id: post.slug,
    body: post.body ?? 'Body copy.',
    data: {
      title: post.title ?? post.slug,
      description: post.description ?? `${post.slug} description`,
      pathSlug: post.slug,
      date: new Date(post.date),
      categories: post.categories ?? [],
      locale: post.locale ?? 'en',
      featured: false,
      legacy: post.legacy ?? false,
      thumbnailImage: post.thumbnailImage,
      featureImage: post.featureImage,
      featureImageAlt: post.featureImageAlt,
      featureImageBlur: post.featureImageBlur,
      articleBios: [],
      relatedArticles: []
    }
  } as unknown as Entry
}

describe('getBlogSearchIndex', () => {
  beforeEach(() => {
    getCollectionMock.mockClear()
  })

  it('returns an empty array when the collection is empty', async () => {
    getCollectionMock.mockResolvedValue([])

    await expect(getBlogSearchIndex()).resolves.toEqual([])
  })

  describe('publish gate', () => {
    const NOW = new Date('2026-09-18T09:30:00.000Z')
    const POSTS = [
      makePost({ slug: 'live', date: '2026-09-01' }),
      makePost({ slug: 'scheduled', date: '2026-12-01' })
    ]

    afterEach(() => {
      setPublishGateForTests(null)
    })

    it('omits a future-dated post on production', async () => {
      // The index is a client-side catalog: a post left in here would stay
      // findable by search even with no listing page behind it.
      setPublishGateForTests({ hideFuturePosts: true, now: NOW })
      getCollectionMock.mockResolvedValue(POSTS)

      const index = await getBlogSearchIndex()

      expect(index.map((entry) => entry.id)).toEqual(['live'])
    })

    it('keeps it everywhere else, newest-first', async () => {
      setPublishGateForTests({ hideFuturePosts: false, now: NOW })
      getCollectionMock.mockResolvedValue(POSTS)

      const index = await getBlogSearchIndex()

      expect(index.map((entry) => entry.id)).toEqual(['scheduled', 'live'])
    })
  })

  describe('thumbnails', () => {
    const IMAGE = '/img/foundation-blog/mapped.jpg'

    afterEach(() => {
      setImageCdnEnabledForTests(null)
      setDeployedImageSourcesForTests(null)
      setOptimizedImageVariantCatalogForTests(null)
    })

    it('ships a srcset covering both rungs, with src on the narrowest', async () => {
      setImageCdnEnabledForTests(true)
      setDeployedImageSourcesForTests([IMAGE])
      getCollectionMock.mockResolvedValue([
        makePost({ slug: 'p', date: '2026-01-01', featureImage: IMAGE })
      ])

      const [entry] = await getBlogSearchIndex()

      expect(entry.thumbnail?.srcset).toContain('640w')
      expect(entry.thumbnail?.srcset).toContain('1280w')
      expect(entry.thumbnail?.srcset).not.toContain('1920w')
      // Narrowest rung, not fullSrc: fullSrc is the widest in CDN mode and the
      // original-dimension file in build mode.
      expect(entry.thumbnail?.src).toContain('w=640')
    })

    it('uses a numbered variant in build mode rather than the full-size file', async () => {
      // Regression guard: cdnWidths only steers CDN mode, so a non-CDN build
      // used to put the original-dimension -full.webp in a ~420px row.
      setImageCdnEnabledForTests(false)
      setOptimizedImageVariantCatalogForTests([
        '/img/optimized/foundation-blog/mapped-640.webp',
        '/img/optimized/foundation-blog/mapped-1280.webp',
        '/img/optimized/foundation-blog/mapped-full.webp'
      ])
      getCollectionMock.mockResolvedValue([
        makePost({ slug: 'p', date: '2026-01-01', featureImage: IMAGE })
      ])

      const [entry] = await getBlogSearchIndex()

      expect(entry.thumbnail?.src).toBe(
        '/img/optimized/foundation-blog/mapped-640.webp'
      )
      expect(entry.thumbnail?.src).not.toContain('-full')
    })

    it('falls back to the raw path with no srcset when nothing is optimizable', async () => {
      setImageCdnEnabledForTests(true)
      setDeployedImageSourcesForTests([])
      getCollectionMock.mockResolvedValue([
        makePost({ slug: 'p', date: '2026-01-01', legacy: true })
      ])

      const [entry] = await getBlogSearchIndex()

      expect(entry.thumbnail?.src).toBe('/img/tech-thumbnail.svg')
      expect(entry.thumbnail?.srcset).toBeUndefined()
    })
  })

  it('puts every searchable field into searchText', async () => {
    // A regression that quietly drops one of these would leave search unable to
    // find posts by that field, with every other test still green.
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'rafiki-dpg',
        date: '2026-01-01',
        title: 'Rafiki is a Digital Public Good',
        description: 'Recognised by the DPGA',
        categories: ['Engineering', 'News'],
        body: 'The certification covers interoperability and open standards.'
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.searchText).toContain('rafiki is a digital public good')
    expect(entry.searchText).toContain('recognised by the dpga')
    expect(entry.searchText).toContain('interoperability')
    expect(entry.searchText).toContain('engineering')
    expect(entry.searchText).toContain('news')
  })

  it('folds accents in searchText so an unaccented query still matches', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'es-post',
        date: '2026-01-01',
        locale: 'es',
        title: 'Política de pagos',
        description: 'Investigación sobre inclusión',
        body: 'Regulación y tecnología.'
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.searchText).toContain('politica de pagos')
    expect(entry.searchText).toContain('investigacion')
    expect(entry.searchText).toContain('regulacion')
    expect(entry.searchText).not.toMatch(/[áéíóúñ]/)
  })

  it('strips markdown so body prose is searchable as plain text', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'md-post',
        date: '2026-01-01',
        body: 'A **bold** claim about [open payments](https://example.com).'
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.searchText).toContain('open payments')
    expect(entry.searchText).not.toContain('**')
    expect(entry.searchText).not.toContain('](')
  })

  it('maps the fields a result row renders', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'mapped-post',
        date: '2026-03-04',
        title: 'Mapped post',
        description: 'A short description',
        categories: ['News'],
        featureImage: '/img/foundation-blog/mapped.jpg',
        featureImageAlt: 'Alt text',
        featureImageBlur: 'data:image/webp;base64,UklGRg=='
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.id).toBe('mapped-post')
    expect(entry.title).toBe('Mapped post')
    expect(entry.descriptionSnippet).toBe('A short description')
    expect(entry.categories).toEqual(['News'])
    expect(entry.date).toBe(new Date('2026-03-04').toISOString())
    expect(entry.postPath).toBe('/blog/mapped-post')
    expect(entry.locale).toBe('en')
    // No variant catalog in tests, so src falls back to the raw path — what
    // matters here is that alt and the LQIP survive into the catalog.
    expect(entry.thumbnail).toEqual({
      src: '/img/foundation-blog/mapped.jpg',
      alt: 'Alt text',
      blur: 'data:image/webp;base64,UklGRg=='
    })
  })

  it('drops a blur that is not a webp data URI', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'bad-blur',
        date: '2026-01-01',
        featureImage: '/img/foundation-blog/x.jpg',
        featureImageBlur: 'javascript:alert(1)'
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.thumbnail?.blur).toBeUndefined()
  })

  it('falls back to the excerpt when a post has no description', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'no-description',
        date: '2026-01-01',
        description: '',
        body: 'Opening line of the post body.'
      })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.descriptionSnippet).toContain('Opening line of the post body.')
  })

  it('has no thumbnail when the post has no images and is not legacy', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'no-images', date: '2026-01-01' })
    ])

    const [entry] = await getBlogSearchIndex()

    expect(entry.thumbnail).toBeNull()
  })

  it('sorts entries newest-first, matching the blog listing order', async () => {
    // getCollection yields glob order — oldest-first for the date-prefixed
    // filenames this collection uses — so the index must sort rather than
    // inherit it, or search results come back oldest-first (INTORG-758).
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'oldest', date: '2018-01-29' }),
      makePost({ slug: 'middle', date: '2023-06-15' }),
      makePost({ slug: 'newest', date: '2026-04-02' })
    ])

    const index = await getBlogSearchIndex()

    expect(index.map((entry) => entry.id)).toEqual([
      'newest',
      'middle',
      'oldest'
    ])
  })

  it('sorts newest-first regardless of the incoming order', async () => {
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'middle', date: '2023-06-15' }),
      makePost({ slug: 'newest', date: '2026-04-02' }),
      makePost({ slug: 'oldest', date: '2018-01-29' })
    ])

    const index = await getBlogSearchIndex()

    expect(index.map((entry) => entry.date)).toEqual([
      new Date('2026-04-02').toISOString(),
      new Date('2023-06-15').toISOString(),
      new Date('2018-01-29').toISOString()
    ])
  })

  it('orders both content languages into one newest-first list', async () => {
    // The catalog is shared across EN and ES (the client filters by locale), so
    // ordering has to hold across locales, not just within one.
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'en-old', date: '2024-01-01', locale: 'en' }),
      makePost({ slug: 'es-new', date: '2025-01-01', locale: 'es' }),
      makePost({ slug: 'en-new', date: '2026-01-01', locale: 'en' })
    ])

    const index = await getBlogSearchIndex()

    expect(index.map((entry) => entry.id)).toEqual([
      'en-new',
      'es-new',
      'en-old'
    ])
  })
})
