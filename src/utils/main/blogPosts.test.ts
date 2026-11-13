import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'

// blogPosts only reaches astro:content (through gatedCollection) for getCollection — its other imports
// are type-only — but the mock still re-exports `z`, since anything that pulls
// in `./locales` at runtime needs it (same convention as blogSearch.test.ts).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
const getCollectionMock = vi.fn().mockResolvedValue([])
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: getCollectionMock }
})

const { getBlogPosts } = await import('./blogPosts')
const { setPublishGateForTests } = await import('./gatedCollection')

const NOW = new Date('2026-09-18T09:30:00.000Z')

interface FakePost {
  slug: string
  date: string
  locale?: string
  categories?: string[]
  localizes?: string
}

function makePost({
  slug,
  date,
  locale = 'en',
  categories = [],
  localizes
}: FakePost): CollectionEntry<'foundation-blog'> {
  return {
    id: slug,
    data: {
      pathSlug: slug,
      date: new Date(date),
      locale,
      categories,
      localizes
    }
  } as unknown as CollectionEntry<'foundation-blog'>
}

// Oldest-first, matching the glob order real date-prefixed filenames produce.
const PAST = makePost({ slug: 'past', date: '2024-03-01' })
const TODAY = makePost({ slug: 'today', date: '2026-09-18' })
const TOMORROW = makePost({ slug: 'tomorrow', date: '2026-09-19' })
const NEXT_MONTH = makePost({ slug: 'next-month', date: '2026-10-20' })
const ALL_POSTS = [PAST, TODAY, TOMORROW, NEXT_MONTH]

function slugsOf(entries: { data: { pathSlug: string } }[]): string[] {
  return entries.map((entry) => entry.data.pathSlug)
}

beforeEach(() => {
  getCollectionMock.mockReset()
  getCollectionMock.mockResolvedValue(ALL_POSTS)
})

afterEach(() => {
  setPublishGateForTests(null)
})

describe('getBlogPosts', () => {
  it('hides future-dated posts when the gate is on', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })

    expect(slugsOf(await getBlogPosts())).toEqual(['today', 'past'])
  })

  it('keeps a post dated today — the launch date has been reached', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })

    expect(slugsOf(await getBlogPosts())).toContain('today')
  })

  it('shows everything when the gate is off, so staging can review upcoming content', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })

    expect(slugsOf(await getBlogPosts())).toEqual([
      'next-month',
      'tomorrow',
      'today',
      'past'
    ])
  })

  it('sorts newest-first regardless of the order the collection yields', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })
    getCollectionMock.mockResolvedValue([PAST, NEXT_MONTH, TODAY, TOMORROW])

    expect(slugsOf(await getBlogPosts())).toEqual([
      'next-month',
      'tomorrow',
      'today',
      'past'
    ])
  })

  it('scopes to one content locale, with the gate still applied', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([
      ...ALL_POSTS,
      makePost({ slug: 'pasado', date: '2024-03-01', locale: 'es' }),
      makePost({ slug: 'manana', date: '2026-09-19', locale: 'es' })
    ])

    expect(slugsOf(await getBlogPosts({ locale: 'es' }))).toEqual(['pasado'])
  })

  it('returns an empty list when every post is still scheduled', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([TOMORROW, NEXT_MONTH])

    expect(await getBlogPosts()).toEqual([])
  })
})
