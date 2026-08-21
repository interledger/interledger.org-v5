import { describe, it, expect, vi } from 'vitest'

// `./stripPagination` -> `./paginatedRouteShape` -> `./tagFilter` /
// `./podcastPagination` reach Astro's virtual modules: `astro:content` for
// getCollection, and (via `./podcastPagination` -> `./locales`)
// `astro:config/client` / `astro:i18n` for i18n config — mock all three (see
// languageSwitcherHrefs.test.ts for the same convention). These cases only
// exercise the route-shape matching, not actual collection or locale data, so
// minimal mocks are enough.
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

const { default: stripPagination } = await import('./stripPagination')

describe('stripPagination', () => {
  it('returns / for an empty path', () => {
    expect(stripPagination('')).toBe('/')
  })

  it('returns / for the root path', () => {
    expect(stripPagination('/')).toBe('/')
  })

  it('leaves a non-paginated path untouched', () => {
    expect(stripPagination('/about-us')).toBe('/about-us')
  })

  it('drops the page number for a paginated blog root page', () => {
    expect(stripPagination('/blog/2')).toBe('/blog')
  })

  it('drops the page number but keeps the category for a paginated blog category page', () => {
    expect(stripPagination('/blog/category/announcements/3')).toBe(
      '/blog/category/announcements'
    )
  })

  it('does not strip a numeric-looking blog category name with no page number', () => {
    expect(stripPagination('/blog/category/2024')).toBe('/blog/category/2024')
  })

  it('drops the page number but keeps a numeric-looking blog category name', () => {
    expect(stripPagination('/blog/category/2024/2')).toBe('/blog/category/2024')
  })

  it('drops the page number for a paginated podcast root page', () => {
    expect(stripPagination('/podcast/2')).toBe('/podcast')
  })

  it('drops the page number but keeps the category for a paginated podcast category page', () => {
    expect(stripPagination('/podcast/category/future-money/4')).toBe(
      '/podcast/category/future-money'
    )
  })

  it('does not strip a numeric-looking podcast category name with no page number', () => {
    expect(stripPagination('/podcast/category/2024')).toBe(
      '/podcast/category/2024'
    )
  })

  it('drops the page number for paginated summit talks', () => {
    expect(stripPagination('/summit/2025/talks/2')).toBe('/summit/2025/talks')
  })

  it('drops the page number for paginated summit speakers', () => {
    expect(stripPagination('/summit/2025/speakers/3')).toBe(
      '/summit/2025/speakers'
    )
  })

  it('does not strip a bare summit year — a real pathSlug that is itself numeric, not a page number', () => {
    expect(stripPagination('/summit/2025')).toBe('/summit/2025')
  })

  it('drops the page number for a locale-prefixed paginated blog category page', () => {
    expect(stripPagination('/es/blog/category/announcements/3')).toBe(
      '/es/blog/category/announcements'
    )
  })

  it('does not strip a locale-prefixed numeric-looking blog category name with no page number', () => {
    expect(stripPagination('/es/blog/category/2024')).toBe(
      '/es/blog/category/2024'
    )
  })

  it('drops the page number for locale-prefixed paginated summit speakers', () => {
    expect(stripPagination('/es/summit/2025/speakers/3')).toBe(
      '/es/summit/2025/speakers'
    )
  })

  it('does not strip a locale-prefixed bare summit year', () => {
    expect(stripPagination('/es/summit/2025')).toBe('/es/summit/2025')
  })

  it('drops the page number for the grantee directory listing', () => {
    expect(stripPagination('/grant/grantee-directory/2')).toBe(
      '/grant/grantee-directory'
    )
  })

  it('does not strip the unpaginated grantee directory path', () => {
    expect(stripPagination('/grant/grantee-directory')).toBe(
      '/grant/grantee-directory'
    )
  })

  it('drops the page number for locale-prefixed grantee directory pages', () => {
    expect(stripPagination('/es/grant/grantee-directory/3')).toBe(
      '/es/grant/grantee-directory'
    )
  })

  it('does not treat a grant program slug digit as a listing page', () => {
    expect(stripPagination('/grant/fellowship/2')).toBe('/grant/fellowship/2')
  })

  it('does not strip a grantee year that looks like a page number', () => {
    expect(stripPagination('/grant/grantee-directory/year/2024')).toBe(
      '/grant/grantee-directory/year/2024'
    )
  })

  it('drops the page number from a grantee year listing', () => {
    expect(stripPagination('/grant/grantee-directory/year/2024/2')).toBe(
      '/grant/grantee-directory/year/2024'
    )
  })

  it('drops the page number from a grantee year and tag listing', () => {
    expect(
      stripPagination('/grant/grantee-directory/year/2024/tag/privacy/3')
    ).toBe('/grant/grantee-directory/year/2024/tag/privacy')
  })

  it('drops the page number from a locale-prefixed grantee year listing', () => {
    expect(stripPagination('/es/grant/grantee-directory/year/2024/2')).toBe(
      '/es/grant/grantee-directory/year/2024'
    )
  })
})
