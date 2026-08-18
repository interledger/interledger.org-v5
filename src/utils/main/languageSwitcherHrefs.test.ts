import { describe, it, expect, vi } from 'vitest'

// `./languageSwitcherHrefs` -> `./routes`/`./translatePath` reach into
// Astro's virtual modules for i18n config, and `./translationMapData` calls
// `astro:content`'s getCollection eagerly at import time to build
// `translationMap` — mock all three (see breadcrumbs.test.ts / navigation.test.ts
// for the same convention). An empty collection list keeps translationMap
// empty, which is fine here: these cases all exercise the pagination-stripping
// fix via the plain slug pass-through branch, not translationMap lookups.
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

const { getLanguageSwitcherHrefs } = await import('./languageSwitcherHrefs')

describe('getLanguageSwitcherHrefs', () => {
  it('drops the page number for a paginated blog root page', () => {
    expect(getLanguageSwitcherHrefs('2', '/blog')).toEqual({
      en: '/blog',
      es: '/es/blog'
    })
  })

  it('matches the unpaginated blog root (same target as a paginated page)', () => {
    expect(getLanguageSwitcherHrefs('', '/blog')).toEqual({
      en: '/blog',
      es: '/es/blog'
    })
  })

  it('drops the page number but keeps the category for a paginated blog category page', () => {
    expect(
      getLanguageSwitcherHrefs('category/announcements/3', '/blog')
    ).toEqual({
      en: '/blog/category/announcements',
      es: '/es/blog/category/announcements'
    })
  })

  it('drops the page number for a paginated podcast root page', () => {
    expect(getLanguageSwitcherHrefs('2', '/podcast')).toEqual({
      en: '/podcast',
      es: '/es/podcast'
    })
  })

  it('drops the page number but keeps the category for a paginated podcast category page', () => {
    expect(
      getLanguageSwitcherHrefs('category/future-money/4', '/podcast')
    ).toEqual({
      en: '/podcast/category/future-money',
      es: '/es/podcast/category/future-money'
    })
  })

  it('leaves a non-paginated slug untouched', () => {
    expect(getLanguageSwitcherHrefs('about-us', '')).toEqual({
      en: '/about-us',
      es: '/es/about-us'
    })
  })

  it('drops the page number for paginated summit talks', () => {
    expect(getLanguageSwitcherHrefs('2025/talks/2', '/summit')).toEqual({
      en: '/summit/2025/talks',
      es: '/es/summit/2025/talks'
    })
  })

  it('drops the page number for paginated summit speakers', () => {
    expect(getLanguageSwitcherHrefs('2025/speakers/3', '/summit')).toEqual({
      en: '/summit/2025/speakers',
      es: '/es/summit/2025/speakers'
    })
  })

  it('does not strip a bare summit year — a real pathSlug that is itself numeric, not a page number', () => {
    expect(getLanguageSwitcherHrefs('2025', '/summit')).toEqual({
      en: '/summit/2025',
      es: '/es/summit/2025'
    })
  })

  it('does not strip a numeric-looking blog category name with no page number', () => {
    expect(getLanguageSwitcherHrefs('category/2024', '/blog')).toEqual({
      en: '/blog/category/2024',
      es: '/es/blog/category/2024'
    })
  })

  it('drops the page number but keeps a numeric-looking blog category name', () => {
    expect(getLanguageSwitcherHrefs('category/2024/2', '/blog')).toEqual({
      en: '/blog/category/2024',
      es: '/es/blog/category/2024'
    })
  })

  it('does not strip a numeric-looking podcast category name with no page number', () => {
    expect(getLanguageSwitcherHrefs('category/2024', '/podcast')).toEqual({
      en: '/podcast/category/2024',
      es: '/es/podcast/category/2024'
    })
  })

  it('drops the page number but keeps a numeric-looking podcast category name', () => {
    expect(getLanguageSwitcherHrefs('category/2024/2', '/podcast')).toEqual({
      en: '/podcast/category/2024',
      es: '/es/podcast/category/2024'
    })
  })
})
