import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const { getCrossSectionPaths } = await import('./static-paths')

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
})
