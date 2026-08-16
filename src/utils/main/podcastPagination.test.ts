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

const { paginatePodcastEpisodes, PODCAST_PAGE_SIZE } =
  await import('./podcastPagination')

type PodcastPageEntry = CollectionEntry<'podcast-pages'>

function makeEpisode(title: string) {
  return {
    title,
    description: `${title} description`,
    url: `https://podcast.example.com/${title}`,
    series: 'Future Money' as const
  }
}

function makePodcastPageEntry(
  locale: string,
  episodeTitles: string[]
): PodcastPageEntry {
  return {
    id: `podcast-${locale}`,
    data: {
      title: 'Podcasts and Vodcasts',
      pathSlug: 'podcast',
      description: 'desc',
      titleCards: { columns: 'Three', ariaLabel: 'Featured series', cards: [] },
      podcasts: episodeTitles.map(makeEpisode),
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

// Records what podcastPagination hands off to Astro's real `paginate`,
// instead of reimplementing pagination math.
function fakePaginate() {
  return vi.fn((data: unknown, opts: unknown) => ({
    data,
    opts
  })) as unknown as PaginateFunction
}

describe('paginatePodcastEpisodes', () => {
  it('paginates the EN entry, newest episode first', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', ['s01e01', 's01e02', 's01e03'])
    ])
    const paginate = fakePaginate()

    const result = (await paginatePodcastEpisodes({
      paginate,
      lang: 'en'
    })) as unknown as {
      data: { title: string }[]
      opts: Record<string, unknown>
    }

    expect(result.data.map((e) => e.title)).toEqual([
      's01e03',
      's01e02',
      's01e01'
    ])
    expect(result.opts.pageSize).toBe(PODCAST_PAGE_SIZE)
    expect(result.opts.props).toEqual(
      expect.objectContaining({ contentLocale: 'en', isFallback: false })
    )
  })

  it('falls back to the EN entry when no ES translation exists', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', ['s01e01'])
    ])
    const paginate = fakePaginate()

    const result = (await paginatePodcastEpisodes({
      paginate,
      lang: 'es'
    })) as unknown as { opts: { props: Record<string, unknown> } }

    expect(result.opts.props).toEqual(
      expect.objectContaining({ contentLocale: 'en', isFallback: true })
    )
  })

  it('uses the ES entry directly when an ES translation exists', async () => {
    getCollectionMock.mockResolvedValue([
      makePodcastPageEntry('en', ['s01e01']),
      makePodcastPageEntry('es', ['s01e01-es'])
    ])
    const paginate = fakePaginate()

    const result = (await paginatePodcastEpisodes({
      paginate,
      lang: 'es'
    })) as unknown as {
      data: { title: string }[]
      opts: { props: Record<string, unknown> }
    }

    expect(result.data.map((e) => e.title)).toEqual(['s01e01-es'])
    expect(result.opts.props).toEqual(
      expect.objectContaining({ contentLocale: 'es', isFallback: false })
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
