import { describe, it, expect } from 'vitest'
import { hrefFromOriginal } from './blog-search'

// syncSearchHrefs itself is a thin DOM loop over this function; the repo has no
// DOM test environment (no jsdom/happy-dom), so the URL logic is covered here
// the same way header-nav.test.ts covers panelMaxHeightSteps.
const ORIGIN = 'https://interledger.org'

describe('hrefFromOriginal', () => {
  it('returns the original untouched when the query is empty', () => {
    expect(hrefFromOriginal('/blog/category/news', '', ORIGIN)).toBe(
      '/blog/category/news'
    )
  })

  it('treats a whitespace-only query as empty', () => {
    expect(hrefFromOriginal('/blog/category/news', '   ', ORIGIN)).toBe(
      '/blog/category/news'
    )
  })

  it('appends the trimmed query as ?q=', () => {
    expect(hrefFromOriginal('/blog/category/news', '  rafiki  ', ORIGIN)).toBe(
      '/blog/category/news?q=rafiki'
    )
  })

  it('rebuilds from the original, so successive queries never compound', () => {
    const original = '/blog/category/news'

    expect(hrefFromOriginal(original, 'rafiki', ORIGIN)).toBe(
      '/blog/category/news?q=rafiki'
    )
    expect(hrefFromOriginal(original, 'open payments', ORIGIN)).toBe(
      '/blog/category/news?q=open+payments'
    )
  })

  it('replaces a query already present on the original', () => {
    expect(
      hrefFromOriginal('/blog/category/news?q=stale', 'fresh', ORIGIN)
    ).toBe('/blog/category/news?q=fresh')
  })

  it('preserves other params and the hash', () => {
    expect(
      hrefFromOriginal('/blog/category/news?page=2#list', 'rafiki', ORIGIN)
    ).toBe('/blog/category/news?page=2&q=rafiki#list')
  })

  it('keeps the /lang/ segment of a content-language link', () => {
    expect(
      hrefFromOriginal('/blog/category/news/lang/es', 'pagos', ORIGIN)
    ).toBe('/blog/category/news/lang/es?q=pagos')
  })

  it('leaves a cross-origin href alone', () => {
    const external = 'https://example.com/elsewhere'
    expect(hrefFromOriginal(external, 'rafiki', ORIGIN)).toBe(external)
  })
})
