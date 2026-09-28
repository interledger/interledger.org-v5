import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))

const { getCollectionMock } = vi.hoisted(() => ({
  getCollectionMock: vi.fn().mockResolvedValue([])
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: getCollectionMock }
})

const { getCrossSectionPaths, getLocalizedPaths } =
  await import('./static-paths')
const { setPublishGateForTests } = await import('./blogPosts')

function faq(data: {
  locale?: string
  pathSlug?: string
  section: string
  localizes?: string
}) {
  return {
    data: {
      locale: 'en',
      pathSlug: 'faq',
      localizes: undefined,
      ...data
    }
  }
}

describe('getCrossSectionPaths', () => {
  beforeEach(() => {
    getCollectionMock.mockImplementation(async (name: string) => {
      if (name !== 'faqs') return []
      return [
        faq({ section: 'foundation' }),
        faq({ section: 'hackathon' }),
        faq({
          locale: 'es',
          section: 'foundation',
          localizes: 'faq',
          pathSlug: 'preguntas-frecuentes'
        })
      ]
    })
  })

  it('keeps same-slug FAQs on their own section routes', async () => {
    const hackathon = await getCrossSectionPaths('hackathon', 'en', 'page')
    const foundation = await getCrossSectionPaths('foundation', 'en', 'page')

    const hackathonFaq = hackathon.filter((p) => p.props.kind === 'faq')
    const foundationFaq = foundation.filter((p) => p.props.kind === 'faq')

    expect(hackathonFaq).toHaveLength(1)
    expect(hackathonFaq[0]?.props).toMatchObject({
      slug: 'faq',
      kind: 'faq',
      section: 'hackathon',
      locale: 'en',
      isFallback: false
    })
    expect(foundationFaq).toHaveLength(1)
    expect(foundationFaq[0]?.props).toMatchObject({
      slug: 'faq',
      kind: 'faq',
      section: 'foundation',
      locale: 'en'
    })
  })

  it('does not use a foundation ES translation for the hackathon FAQ', async () => {
    const paths = await getCrossSectionPaths('hackathon', 'es', 'page')
    const faqPaths = paths.filter((p) => p.props.kind === 'faq')

    expect(faqPaths).toHaveLength(1)
    expect(faqPaths[0]?.props).toMatchObject({
      slug: 'faq',
      locale: 'en',
      isFallback: true,
      section: 'hackathon'
    })
  })

  // The section filter must not go so far that a section stops seeing its own
  // translation. Foundation owns the only ES entry, so it gets the real slug.
  it('still uses a section its own ES translation', async () => {
    const paths = await getCrossSectionPaths('foundation', 'es', 'page')
    const faqPaths = paths.filter((p) => p.props.kind === 'faq')

    expect(faqPaths).toHaveLength(1)
    expect(faqPaths[0]?.params.page).toBe('preguntas-frecuentes')
    expect(faqPaths[0]?.props).toMatchObject({
      locale: 'es',
      isFallback: false,
      section: 'foundation'
    })
  })
})

describe('getLocalizedPaths publish gate', () => {
  const NOW = new Date('2026-09-18T09:30:00.000Z')

  function post(data: {
    pathSlug: string
    date: string
    locale?: string
    localizes?: string
  }) {
    return {
      data: {
        locale: 'en',
        localizes: undefined,
        ...data,
        date: new Date(data.date)
      }
    }
  }

  function mockBlog(entries: unknown[]) {
    getCollectionMock.mockImplementation(async (name: string) =>
      name === 'foundation-blog' ? entries : []
    )
  }

  afterEach(() => {
    setPublishGateForTests(null)
  })

  it('emits no path for a future-dated post, so its URL 404s', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    mockBlog([
      post({ pathSlug: 'live', date: '2026-09-01' }),
      post({ pathSlug: 'scheduled', date: '2026-12-01' })
    ])

    const paths = await getLocalizedPaths('foundation-blog', 'en', 'id')

    expect(paths.map((p) => p.params.id)).toEqual(['live'])
  })

  it('emits both when the gate is off, so staging can review upcoming content', async () => {
    setPublishGateForTests({ hideFuturePosts: false, now: NOW })
    mockBlog([
      post({ pathSlug: 'live', date: '2026-09-01' }),
      post({ pathSlug: 'scheduled', date: '2026-12-01' })
    ])

    const paths = await getLocalizedPaths('foundation-blog', 'en', 'id')

    expect(paths.map((p) => p.params.id)).toEqual(['live', 'scheduled'])
  })

  it('takes a translation off the map with its scheduled EN original', async () => {
    // ES paths are derived from the EN entry list, so gating EN is enough.
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    mockBlog([
      post({ pathSlug: 'scheduled', date: '2026-12-01' }),
      post({
        pathSlug: 'programado',
        date: '2026-12-01',
        locale: 'es',
        localizes: 'scheduled'
      })
    ])

    expect(await getLocalizedPaths('foundation-blog', 'es', 'id')).toEqual([])
  })

  it('falls back to EN when only the ES translation is scheduled', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    mockBlog([
      post({ pathSlug: 'live', date: '2026-09-01' }),
      post({
        pathSlug: 'en-vivo',
        date: '2026-12-01',
        locale: 'es',
        localizes: 'live'
      })
    ])

    const paths = await getLocalizedPaths('foundation-blog', 'es', 'id')

    expect(paths).toHaveLength(1)
    expect(paths[0].params.id).toBe('live')
    expect(paths[0].props).toMatchObject({ locale: 'en', isFallback: true })
  })

  it('leaves an ungated collection alone', async () => {
    setPublishGateForTests({ hideFuturePosts: true, now: NOW })
    getCollectionMock.mockImplementation(async (name: string) =>
      name === 'foundation-pages'
        ? [{ data: { pathSlug: 'about', locale: 'en' } }]
        : []
    )

    const paths = await getLocalizedPaths('foundation-pages', 'en', 'page')

    expect(paths.map((p) => p.params.page)).toEqual(['about'])
  })
})
