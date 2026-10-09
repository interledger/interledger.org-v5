import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'

// gatedCollection only reaches astro:content for getCollection — its other imports
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

const { getGatedCollection, setPublishGateForTests } =
  await import('./gatedCollection')

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

describe('getGatedCollection', () => {
  it('leaves an ungated collection untouched even with the gate on', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    const pages = [
      { id: 'a', data: { pathSlug: 'a', date: new Date('2030-01-01') } },
      { id: 'b', data: { pathSlug: 'b' } }
    ]
    getCollectionMock.mockResolvedValue(pages)

    expect(await getGatedCollection('foundation-pages')).toEqual(pages)
  })

  it('leaves reports untouched — its `date` is an object, not a publish date', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    const reports = [
      {
        id: 'r',
        data: {
          pathSlug: 'r',
          date: { publishDate: '2030-01-01', lastUpdated: '2030-02-01' }
        }
      }
    ]
    getCollectionMock.mockResolvedValue(reports)

    expect(await getGatedCollection('reports')).toEqual(reports)
  })

  it('keeps an entry whose date is missing rather than hiding it', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    const undated = { id: 'undated', data: { pathSlug: 'undated' } }
    getCollectionMock.mockResolvedValue([TOMORROW, undated])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'undated'
    ])
  })

  it('preserves collection order — sorting is getBlogPosts’ job', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'past',
      'today',
      'tomorrow',
      'next-month'
    ])
  })
})

describe('orphaned translations', () => {
  // getLocalizedPaths builds every ES route from the EN entry list, so a
  // translation outliving its scheduled original would be listed, filtered and
  // indexed with no page behind it (INTORG-1239).
  const SCHEDULED_EN = makePost({ slug: 'scheduled', date: '2026-12-01' })
  const PAST_ES = makePost({
    slug: 'programado',
    date: '2025-01-15',
    locale: 'es',
    localizes: 'scheduled'
  })

  it('drops a past-dated translation whose original is still scheduled', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockResolvedValue([SCHEDULED_EN, PAST_ES])

    expect(await getGatedCollection('foundation-blog')).toEqual([])
  })

  it('keeps a translation whose original survived', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    const liveEn = makePost({ slug: 'live', date: '2026-09-01' })
    const liveEs = makePost({
      slug: 'en-vivo',
      date: '2025-01-15',
      locale: 'es',
      localizes: 'live'
    })
    getCollectionMock.mockResolvedValue([liveEn, liveEs])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'live',
      'en-vivo'
    ])
  })

  it('keeps both when the gate is off, so staging still reviews the pair', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })
    getCollectionMock.mockResolvedValue([SCHEDULED_EN, PAST_ES])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'scheduled',
      'programado'
    ])
  })

  it('leaves a translation with a dangling localizes alone — not this gate\u2019s bug', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })
    const orphan = makePost({
      slug: 'huerfano',
      date: '2025-01-15',
      locale: 'es',
      localizes: 'never-existed'
    })
    getCollectionMock.mockResolvedValue([orphan])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'huerfano'
    ])
  })

  it('does not treat a standalone ES post (no localizes) as an orphan', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    const standalone = makePost({
      slug: 'independiente',
      date: '2025-01-15',
      locale: 'es'
    })
    getCollectionMock.mockResolvedValue([SCHEDULED_EN, standalone])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'independiente'
    ])
  })
})

describe('drafts', () => {
  function page(data: Record<string, unknown>) {
    return { id: String(data.pathSlug), data: { locale: 'en', ...data } }
  }

  it('drops a draft from any collection when the gate is on', async () => {
    setPublishGateForTests({ hideDrafts: true, hideFuturePosts: false })
    getCollectionMock.mockResolvedValue([
      page({ pathSlug: 'live' }),
      page({ pathSlug: 'wip', draft: true }),
      page({ pathSlug: 'explicit', draft: false })
    ])

    expect(slugsOf(await getGatedCollection('foundation-pages'))).toEqual([
      'live',
      'explicit'
    ])
  })

  it('keeps drafts when the gate is off, so staging can review them', async () => {
    setPublishGateForTests({ hideDrafts: false, hideFuturePosts: false })
    const pages = [
      page({ pathSlug: 'live' }),
      page({ pathSlug: 'wip', draft: true })
    ]
    getCollectionMock.mockResolvedValue(pages)

    expect(await getGatedCollection('faqs')).toEqual(pages)
  })

  it('drops the translations of a draft original', async () => {
    setPublishGateForTests({ hideDrafts: true, hideFuturePosts: false })
    getCollectionMock.mockResolvedValue([
      page({ pathSlug: 'wip', draft: true }),
      page({ pathSlug: 'borrador', locale: 'es', localizes: 'wip' })
    ])

    expect(await getGatedCollection('grant-pages')).toEqual([])
  })

  it('keeps the original when only its translation is a draft', async () => {
    setPublishGateForTests({ hideDrafts: true, hideFuturePosts: false })
    getCollectionMock.mockResolvedValue([
      page({ pathSlug: 'live' }),
      page({
        pathSlug: 'en-vivo',
        locale: 'es',
        localizes: 'live',
        draft: true
      })
    ])

    expect(slugsOf(await getGatedCollection('grant-pages'))).toEqual(['live'])
  })

  it('leaves a translation with a dangling localizes alone', async () => {
    setPublishGateForTests({ hideDrafts: true, hideFuturePosts: false })
    const pages = [
      page({ pathSlug: 'wip', draft: true }),
      page({ pathSlug: 'huerfano', locale: 'es', localizes: 'never-existed' })
    ]
    getCollectionMock.mockResolvedValue(pages)

    expect(slugsOf(await getGatedCollection('foundation-pages'))).toEqual([
      'huerfano'
    ])
  })

  it('scopes the cascade to the section, since cross-section slugs repeat', async () => {
    setPublishGateForTests({ hideDrafts: true, hideFuturePosts: false })
    getCollectionMock.mockResolvedValue([
      page({ pathSlug: 'faq', section: 'summit', draft: true }),
      page({ pathSlug: 'faq', section: 'foundation' }),
      page({
        pathSlug: 'preguntas',
        section: 'foundation',
        locale: 'es',
        localizes: 'faq'
      }),
      page({
        pathSlug: 'preguntas-summit',
        section: 'summit',
        locale: 'es',
        localizes: 'faq'
      })
    ])

    expect(slugsOf(await getGatedCollection('faqs'))).toEqual([
      'faq',
      'preguntas'
    ])
  })

  it('applies both gates to the blog independently', async () => {
    setPublishGateForTests({
      hideDrafts: true,
      hideFuturePosts: true,
      now: NOW
    })
    const draftPast = makePost({ slug: 'draft-past', date: '2024-01-01' })
    ;(draftPast.data as { draft?: boolean }).draft = true
    getCollectionMock.mockResolvedValue([PAST, draftPast, TOMORROW])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'past'
    ])
  })

  it('applies only the date gate when drafts are shown', async () => {
    setPublishGateForTests({
      hideDrafts: false,
      hideFuturePosts: true,
      now: NOW
    })
    const draftPast = makePost({ slug: 'draft-past', date: '2024-01-01' })
    ;(draftPast.data as { draft?: boolean }).draft = true
    getCollectionMock.mockResolvedValue([PAST, draftPast, TOMORROW])

    expect(slugsOf(await getGatedCollection('foundation-blog'))).toEqual([
      'past',
      'draft-past'
    ])
  })
})
