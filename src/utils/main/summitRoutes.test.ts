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

const { summitBaseHref, summitYearHref } = await import('./summitRoutes')
const { YEARS, currentSummitYear } = await import('./sessionize')

const pastYear = YEARS[0]

describe('summitBaseHref', () => {
  it('prefixes the locale except for the default one', () => {
    expect(summitBaseHref('en')).toBe('/summit/')
    expect(summitBaseHref('es')).toBe('/es/summit/')
  })
})

describe('summitYearHref', () => {
  it('sends the current summit year to the landing page', () => {
    expect(summitYearHref(currentSummitYear!, 'en')).toBe('/summit/')
    expect(summitYearHref(currentSummitYear!, 'es')).toBe('/es/summit/')
  })

  it('gives an earlier year its own slashed page', () => {
    expect(pastYear).not.toBe(currentSummitYear)
    expect(summitYearHref(pastYear, 'en')).toBe(`/summit/${pastYear}/`)
    expect(summitYearHref(pastYear, 'es')).toBe(`/es/summit/${pastYear}/`)
  })
})
