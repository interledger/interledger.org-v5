import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'
import type { PaginateFunction } from 'astro'

// `./tagFilter` -> `./i18` -> `./locales` reaches into Astro's virtual modules
// for i18n config, and `./blogPosts` calls the `astro:content` getCollection
// export directly — mock both (same convention as podcastPagination.test.ts).
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

const { paginateAllPosts, paginatePostsByTerm, ALL_TERM_SLUG } =
  await import('./tagFilter')
const { setPublishGateForTests } = await import('./blogPosts')

const NOW = new Date('2026-09-18T09:30:00.000Z')

type Entry = CollectionEntry<'foundation-blog'>

interface FakePost {
  slug: string
  date: string
  locale?: string
  categories?: string[]
}

function makePost({
  slug,
  date,
  locale = 'en',
  categories = []
}: FakePost): Entry {
  return {
    id: slug,
    data: { pathSlug: slug, date: new Date(date), locale, categories }
  } as unknown as Entry
}

interface FakePage {
  data: Entry[]
  opts: {
    params?: Record<string, unknown>
    pageSize: number
    props: Record<string, unknown>
  }
}

// Records what tagFilter hands off to Astro's real `paginate` (which returns an
// array of page-path descriptors), instead of reimplementing pagination math.
function fakePaginate() {
  return vi.fn((data: unknown, opts: unknown) => [
    { data, opts }
  ]) as unknown as PaginateFunction
}

function slugsOf(entries: Entry[]): string[] {
  return entries.map((entry) => entry.data.pathSlug)
}

function termSlugsOf(pages: FakePage[]): unknown[] {
  return pages.map((page) => page.opts.params?.category)
}

beforeEach(() => {
  getCollectionMock.mockReset()
  getCollectionMock.mockResolvedValue([])
})

afterEach(() => {
  setPublishGateForTests(null)
})

describe('paginateAllPosts', () => {
  it('lists posts newest-first', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'old', date: '2024-01-01' }),
      makePost({ slug: 'new', date: '2026-05-01' })
    ])

    const [page] = (await paginateAllPosts({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en'
    })) as unknown as FakePage[]

    expect(slugsOf(page.data)).toEqual(['new', 'old'])
  })

  it('omits a future-dated post, and does not count it in totalEntries', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'live', date: '2026-09-01' }),
      makePost({ slug: 'scheduled', date: '2026-12-01' })
    ])

    const [page] = (await paginateAllPosts({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en'
    })) as unknown as FakePage[]

    expect(slugsOf(page.data)).toEqual(['live'])
    expect(page.opts.props.totalEntries).toBe(1)
  })

  it('scopes to the requested content language', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({ slug: 'live-en', date: '2026-09-01' }),
      makePost({ slug: 'live-es', date: '2026-09-01', locale: 'es' }),
      makePost({ slug: 'scheduled-es', date: '2026-12-01', locale: 'es' })
    ])

    const [page] = (await paginateAllPosts({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en',
      contentLang: 'es'
    })) as unknown as FakePage[]

    expect(slugsOf(page.data)).toEqual(['live-es'])
  })
})

describe('paginatePostsByTerm', () => {
  it('drops a category whose only post is future-dated', async () => {
    // Otherwise the pill would advertise a filter with nothing behind it, and
    // hint at unlaunched content by name.
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'live',
        date: '2026-09-01',
        categories: ['Announcements']
      }),
      makePost({
        slug: 'scheduled',
        date: '2026-12-01',
        categories: ['Interledger Summit']
      })
    ])

    const pages = (await paginatePostsByTerm({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en'
    })) as unknown as FakePage[]

    // allTerms rides on every page's props, so check one and check the routes.
    expect(pages[0].opts.props.allTerms).toEqual(['Announcements'])
    expect(termSlugsOf(pages)).toEqual(['announcements', ALL_TERM_SLUG])
  })

  it('keeps a category that still has a published post', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'live',
        date: '2026-09-01',
        categories: ['Announcements']
      }),
      makePost({
        slug: 'scheduled',
        date: '2026-12-01',
        categories: ['Announcements']
      })
    ])

    const pages = (await paginatePostsByTerm({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en'
    })) as unknown as FakePage[]

    const [termPage] = pages
    expect(termPage.opts.params?.category).toBe('announcements')
    expect(slugsOf(termPage.data)).toEqual(['live'])
  })

  it('always emits the canonical "all" page so the All pill has a URL', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'scheduled',
        date: '2026-12-01',
        categories: ['Announcements']
      })
    ])

    const pages = (await paginatePostsByTerm({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'en'
    })) as unknown as FakePage[]

    expect(termSlugsOf(pages)).toEqual([ALL_TERM_SLUG])
  })

  it('falls back to all posts of the language when the gate empties a term for it', async () => {
    // A term kept alive by a live EN post whose only ES post is scheduled: the
    // existing empty-term fallback should render the ES listing rather than
    // 404, with the term flagged so the UI clears the selected pill.
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      makePost({
        slug: 'live-en',
        date: '2026-09-01',
        categories: ['Announcements']
      }),
      makePost({
        slug: 'live-es',
        date: '2026-09-01',
        locale: 'es',
        categories: ['Community']
      }),
      makePost({
        slug: 'scheduled-es',
        date: '2026-12-01',
        locale: 'es',
        categories: ['Announcements']
      })
    ])

    const pages = (await paginatePostsByTerm({
      paginate: fakePaginate(),
      collection: 'foundation-blog',
      lang: 'es'
    })) as unknown as FakePage[]

    const announcements = pages.find(
      (page) => page.opts.params?.category === 'announcements'
    )
    expect(announcements?.opts.props.isTermFallback).toBe(true)
    expect(slugsOf(announcements?.data ?? [])).toEqual(['live-es'])
  })
})
