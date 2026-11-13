import { describe, expect, it, vi } from 'vitest'

vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: vi.fn().mockResolvedValue([]) }
})
vi.mock('./extractSessionize', () => ({
  getTalks: vi.fn().mockResolvedValue([]),
  getSpeakers: vi.fn().mockResolvedValue([])
}))

const entriesByCollection: Record<string, unknown[]> = {
  'fundraising-pages': [
    { data: { pathSlug: 'support-us', locale: 'en' } },
    { data: { pathSlug: 'apoyanos', locale: 'es', localizes: 'support-us' } }
  ]
}
vi.mock('./gatedCollection', () => ({
  getGatedCollection: vi.fn(
    async (name: string) => entriesByCollection[name] ?? []
  )
}))

const { buildMap } = await import('./translationMap')

describe('buildMap', () => {
  // 0023b135: fundraising-pages was missing from ROUTE_BASES, so the language
  // switcher never saw the Spanish slug.
  it('pairs a fundraising page with its Spanish translation', async () => {
    const map = await buildMap()

    expect(map['support-us']).toEqual({ en: 'support-us', es: 'apoyanos' })
    expect(map['apoyanos']).toEqual({ en: 'support-us', es: 'apoyanos' })
  })
})
