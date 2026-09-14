import { describe, it, expect, vi, beforeEach } from 'vitest'
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

type Entry = CollectionEntry<'foundation-blog'>

interface FakePost {
  slug: string
  date: string
  title?: string
  description?: string
  categories?: string[]
  locale?: string
  body?: string
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
      legacy: false,
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
