import { describe, expect, it, vi } from 'vitest'

// `./routes` -> `./locales` reaches Astro's virtual modules for i18n config.
// These cases only exercise path building, so minimal mocks are enough
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

const { normalizeBasePath, localizeRoute } = await import('./routes')

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

describe('localizeRoute', () => {
  it.each([
    ['', 'en', '/'],
    ['/', 'en', '/'],
    ['', 'es', '/es/'],
    ['/', 'es', '/es/'],
    ['/blog', 'en', '/blog/'],
    ['/blog', 'es', '/es/blog/'],
    ['blog', 'en', '/blog/'],
    ['/blog/', 'en', '/blog/'],
    ['/blog/', 'es', '/es/blog/'],
    ['grant/our-grantmaking', 'es', '/es/grant/our-grantmaking/']
  ] as const)('localizes %j for %s as %j', (basePath, locale, expected) => {
    expect(localizeRoute(basePath, locale)).toBe(expected)
  })
})
