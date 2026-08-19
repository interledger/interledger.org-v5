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

const { normalizeBasePath } = await import('./routes')

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
