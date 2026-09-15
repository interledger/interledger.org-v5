import { describe, it, expect } from 'vitest'
import { computeSearchViewState, hrefFromOriginal } from './blog-search'

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

describe('computeSearchViewState', () => {
  const BASELINE = { initialStaticHidden: false, initialEmptyHidden: true }

  it('restores the page-load listing when returning to static mode', () => {
    expect(computeSearchViewState({ mode: 'static', ...BASELINE })).toEqual({
      staticHidden: false,
      emptyHidden: true,
      resultsHidden: true,
      countHidden: true,
      errorHidden: true,
      langNoticeHidden: false,
      paginationHidden: false,
      termFallbackHidden: false,
      busy: false
    })
  })

  it('hides pagination and the term-fallback notice as soon as a search starts', () => {
    // Both regressions Copilot flagged: pagination used to stay up through the
    // debounce+fetch, and "No posts found for this tag…" used to sit above the
    // results because it lives outside the static list.
    const state = computeSearchViewState({
      mode: 'searching',
      awaitingFetch: true
    })

    expect(state.paginationHidden).toBe(true)
    expect(state.termFallbackHidden).toBe(true)
    expect(state.staticHidden).toBe(true)
  })

  it('only marks the region busy when a fetch is actually pending', () => {
    expect(
      computeSearchViewState({ mode: 'searching', awaitingFetch: true }).busy
    ).toBe(true)
    // A cached catalog filters in the same tick, so flagging busy would just
    // churn the attribute.
    expect(
      computeSearchViewState({ mode: 'searching', awaitingFetch: false }).busy
    ).toBe(false)
  })

  it('shows results and hides the empty state when there are matches', () => {
    const state = computeSearchViewState({ mode: 'results', resultCount: 3 })

    expect(state.resultsHidden).toBe(false)
    expect(state.emptyHidden).toBe(true)
    expect(state.countHidden).toBe(false)
    expect(state.busy).toBe(false)
  })

  it('shows the empty state and hides the list when a search matches nothing', () => {
    const state = computeSearchViewState({ mode: 'results', resultCount: 0 })

    expect(state.resultsHidden).toBe(true)
    expect(state.emptyHidden).toBe(false)
  })

  it('brings the listing back alongside the error notice on failure', () => {
    // The failed-fetch case: the static listing returns, but labelled, so it
    // cannot be mistaken for search results.
    const state = computeSearchViewState({ mode: 'error', ...BASELINE })

    expect(state.errorHidden).toBe(false)
    expect(state.staticHidden).toBe(false)
    expect(state.paginationHidden).toBe(false)
    expect(state.resultsHidden).toBe(true)
    expect(state.busy).toBe(false)
  })
})
