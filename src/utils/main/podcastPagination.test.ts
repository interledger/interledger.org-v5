import { describe, it, expect, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'
import type { PaginateFunction } from 'astro'

// `./podcastPagination` -> `./routes` -> `./locales` reaches into Astro's
// virtual modules for i18n config, and the module itself calls the
// `astro:content` getCollection export directly — mock both (see
// breadcrumbs.test.ts / navigation.test.ts for the same convention).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
const getCollectionMock = vi.fn()
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: getCollectionMock }
})

const {
  paginatePodcastEpisodes,
  paginatePodcastEpisodesByTerm,
  PODCAST_PAGE_SIZE
} = await import('./podcastPagination')

type PodcastPageEntry = CollectionEntry<'podcast-pages'>
type PodcastSeries = 'Future Money' | 'Off the Ledger' | 'Interledger Salon'

interface FakePage {
  data: { title: string }[]
  opts: {
    params?: Record<string, unknown>
    pageSize: number
    props: Record<string, unknown>
  }
}

function makeEpisode(title: string, series: PodcastSeries = 'Future Money') {
  return {
    title,
    description: `${title} description`,
    url: `https://podcast.example.com/${title}`,
    series
  }
}

function makePodcastPageEntry(
  locale: string,
  episodes: ReturnType<typeof makeEpisode>[]
): PodcastPageEntry {
  return {
    id: `podcast-${locale}`,
    data: {
      title: 'Podcasts and Vodcasts',
      pathSlug: 'podcast',
      description: 'desc',
      titleCards: {
        columns: 'Three',
        ariaLabel: 'Featured series',
        cards: []
      },
      podcasts: episodes,
      ctaStrip: {
        heading: 'h',
        description: 'd',
        buttonText: 'b',
        buttonLink: '/'
      },
      locale
    }
  } as unknown as PodcastPageEntry
}

// Records what podcastPagination hands off to Astro's real `paginate` (which
// returns an array of page-path descriptors), instead of reimplementing
// pagination math.
function fakePaginate() {
  return vi.fn((data: unknown, opts: unknown) => [
    { data, opts }
  ]) as unknown as PaginateFunction
}

describe('paginatePodcastEpisodes', () => {
  it('paginates the EN entry, newest episode first', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', [
        makeEpisode('s01e01'),
        makeEpisode('s01e02'),
        makeEpisode('s01e03')
      ])
    ])
    const paginate = fakePaginate()

    const [result] = (await paginatePodcastEpisodes({
      paginate,
      lang: 'en'
    })) as unknown as FakePage[]

    expect(result.data.map((e) => e.title)).toEqual([
      's01e03',
      's01e02',
      's01e01'
    ])
    expect(result.opts.pageSize).toBe(PODCAST_PAGE_SIZE)
    expect(result.opts.props).toEqual(
      expect.objectContaining({
        isFallback: false,
        allTerms: ['Future Money']
      })
    )
  })

  it('falls back to the EN entry when no ES translation exists', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', [makeEpisode('s01e01')])
    ])
    const paginate = fakePaginate()

    const [result] = (await paginatePodcastEpisodes({
      paginate,
      lang: 'es'
    })) as unknown as FakePage[]

    expect(result.opts.props).toEqual(
      expect.objectContaining({ isFallback: true })
    )
  })

  it('uses the ES entry directly when an ES translation exists', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', [makeEpisode('s01e01')]),
      makePodcastPageEntry('es', [makeEpisode('s01e01-es')])
    ])
    const paginate = fakePaginate()

    const [result] = (await paginatePodcastEpisodes({
      paginate,
      lang: 'es'
    })) as unknown as FakePage[]

    expect(result.data.map((e) => e.title)).toEqual(['s01e01-es'])
    expect(result.opts.props).toEqual(
      expect.objectContaining({ isFallback: false })
    )
  })

  it('returns no paths when neither the requested nor the default locale has an entry', async () => {
    getCollectionMock.mockResolvedValue([])
    const paginate = fakePaginate()

    const result = await paginatePodcastEpisodes({ paginate, lang: 'en' })

    expect(result).toEqual([])
    expect(paginate).not.toHaveBeenCalled()
  })
})

describe('paginatePodcastEpisodesByTerm', () => {
  it('paginates each series term plus a canonical "all" path, newest episode first', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', [
        makeEpisode('fm1', 'Future Money'),
        makeEpisode('otl1', 'Off the Ledger'),
        makeEpisode('fm2', 'Future Money')
      ])
    ])
    const paginate = fakePaginate()

    const result = (await paginatePodcastEpisodesByTerm({
      paginate,
      lang: 'en'
    })) as unknown as FakePage[]

    // 2 terms (Future Money, Off the Ledger) + 1 canonical "all" path.
    expect(result).toHaveLength(3)

    const byCategory = new Map(result.map((r) => [r.opts.params?.category, r]))

    expect(byCategory.get('future-money')?.data.map((e) => e.title)).toEqual([
      'fm2',
      'fm1'
    ])
    expect(byCategory.get('future-money')?.opts.props).toEqual(
      expect.objectContaining({
        selectedTerm: 'Future Money',
        allTerms: ['Future Money', 'Off the Ledger']
      })
    )

    expect(byCategory.get('off-the-ledger')?.data.map((e) => e.title)).toEqual([
      'otl1'
    ])

    expect(byCategory.get('all')?.data.map((e) => e.title)).toEqual([
      'fm2',
      'otl1',
      'fm1'
    ])
    expect(byCategory.get('all')?.opts.props).toEqual(
      expect.objectContaining({ selectedTerm: undefined })
    )
  })

  it('falls back to the EN entry when no ES translation exists', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', [makeEpisode('s01e01', 'Future Money')])
    ])
    const paginate = fakePaginate()

    const result = (await paginatePodcastEpisodesByTerm({
      paginate,
      lang: 'es'
    })) as unknown as FakePage[]

    // 1 term (Future Money) + 1 canonical "all" path, both from the EN entry.
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.opts.props.isFallback === true)).toBe(true)

    const byCategory = new Map(result.map((r) => [r.opts.params?.category, r]))
    expect(byCategory.get('future-money')?.opts.props).toEqual(
      expect.objectContaining({
        selectedTerm: 'Future Money',
        allTerms: ['Future Money']
      })
    )
    expect(byCategory.get('all')?.data.map((e) => e.title)).toEqual(['s01e01'])
  })

  it('returns no paths when neither the requested nor the default locale has an entry', async () => {
    getCollectionMock.mockResolvedValue([])
    const paginate = fakePaginate()

    const result = await paginatePodcastEpisodesByTerm({
      paginate,
      lang: 'en'
    })

    expect(result).toEqual([])
    expect(paginate).not.toHaveBeenCalled()
  })
})
