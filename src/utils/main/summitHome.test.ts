import { describe, expect, it, vi } from 'vitest'

// `./locales` reaches Astro's virtual modules for i18n config.
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z }
})

const { resolveSummitHome } = await import('./summitHome')

const page = (pathSlug: string, locale: string) => ({
  data: { pathSlug, locale }
})

describe('resolveSummitHome', () => {
  it('uses the page locale when it has its own home', () => {
    const pages = [page('home', 'en'), page('home', 'es')]
    expect(resolveSummitHome(pages, 'es')).toEqual({
      contentLocale: 'es',
      isFallback: false
    })
  })

  it('falls back to the default locale home', () => {
    const pages = [page('home', 'en'), page('about', 'es')]
    expect(resolveSummitHome(pages, 'es')).toEqual({
      contentLocale: 'en',
      isFallback: true
    })
  })

  it('returns an error when no home survived, e.g. a draft EN home', () => {
    const pages = [page('about', 'en'), page('about', 'es')]
    const result = resolveSummitHome(pages, 'en')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('en summit index route')
  })

  it('returns an error for an empty collection', () => {
    expect(resolveSummitHome([], 'es')).toBeInstanceOf(Error)
  })
})
