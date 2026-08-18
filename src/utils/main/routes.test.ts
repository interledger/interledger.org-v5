import { describe, expect, it, vi } from 'vitest'

// `./routes` -> `./locales` reaches Astro's virtual modules for i18n config.
// These cases only exercise base-path matching, so minimal mocks are enough
// (same convention as stripPagination.test.ts).
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

const { isHackathonBasePath, normalizeBasePath, ROUTE_BASES } =
  await import('./routes')

describe('isHackathonBasePath', () => {
  it('matches the hackathon base path', () => {
    expect(isHackathonBasePath(ROUTE_BASES['hackathon-pages'])).toBe(true)
  })

  it('matches a base path with no leading slash', () => {
    expect(isHackathonBasePath('hackathon')).toBe(true)
  })

  it('rejects the other microsite', () => {
    expect(isHackathonBasePath(ROUTE_BASES['summit-pages'])).toBe(false)
  })

  it.each(['', '/', '/blog', '/grant', '/podcast'])(
    'rejects %j',
    (basePath) => {
      expect(isHackathonBasePath(basePath)).toBe(false)
    }
  )

  it('rejects a full page path rather than a base path', () => {
    // `routeContextFromPathname` always hands back the base alone, never the
    // slug with it. Guard the contract so a caller passing `Astro.url.pathname`
    // by mistake fails loudly instead of silently keeping the arrow.
    expect(isHackathonBasePath('/hackathon/overview')).toBe(false)
  })

  it('rejects a base path that only starts with the hackathon base', () => {
    expect(isHackathonBasePath('/hackathon-archive')).toBe(false)
  })
})

describe('normalizeBasePath', () => {
  it('treats an empty base and the site root alike', () => {
    expect(normalizeBasePath('')).toBe('')
    expect(normalizeBasePath('/')).toBe('')
  })

  it('adds a leading slash', () => {
    expect(normalizeBasePath('summit')).toBe('/summit')
  })

  it('leaves an already-normalized base alone', () => {
    expect(normalizeBasePath('/summit')).toBe('/summit')
  })
})
