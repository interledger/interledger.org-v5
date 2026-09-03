import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  computeSearchViewState,
  formatResultsCount,
  loadIndex,
  parseInitialQuery,
  updateUrlQuery
} from './grantee-search'

describe('computeSearchViewState', () => {
  it('restores the page-load static/empty split when returning to static mode', () => {
    expect(
      computeSearchViewState({
        mode: 'static',
        initialStaticHidden: false,
        initialEmptyHidden: true
      })
    ).toEqual({
      staticHidden: false,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: false
    })
  })

  it('shows results and hides pagination when a search has matches', () => {
    expect(
      computeSearchViewState({ mode: 'results', resultsCount: 3 })
    ).toEqual({
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: false,
      paginationHidden: true
    })
  })

  it('shows the empty state and hides pagination when a search has no matches', () => {
    expect(
      computeSearchViewState({ mode: 'results', resultsCount: 0 })
    ).toEqual({
      staticHidden: true,
      emptyHidden: false,
      resultsHidden: true,
      paginationHidden: true
    })
  })
})

describe('formatResultsCount', () => {
  it('substitutes the count into the template', () => {
    expect(formatResultsCount('{count} grantees found', 12)).toBe(
      '12 grantees found'
    )
  })

  it('leaves a template with no placeholder unchanged', () => {
    expect(formatResultsCount('Grantees', 5)).toBe('Grantees')
  })
})

describe('parseInitialQuery', () => {
  it('reads the q param from the URL', () => {
    expect(
      parseInitialQuery(
        'https://interledger.org/grant/grantee-directory/?q=education'
      )
    ).toBe('education')
  })

  it('returns an empty string when q is absent', () => {
    expect(
      parseInitialQuery('https://interledger.org/grant/grantee-directory/')
    ).toBe('')
  })
})

describe('updateUrlQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets the q param when given a query', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: { href: 'https://interledger.org/grant/grantee-directory/' },
      history: { state: null, replaceState }
    })

    updateUrlQuery('open payments')

    expect(replaceState).toHaveBeenCalledTimes(1)
    const [, , url] = replaceState.mock.calls[0]
    expect((url as URL).searchParams.get('q')).toBe('open payments')
  })

  it('removes the q param when the query is empty', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: {
        href: 'https://interledger.org/grant/grantee-directory/?q=education'
      },
      history: { state: null, replaceState }
    })

    updateUrlQuery('')

    const [, , url] = replaceState.mock.calls[0]
    expect((url as URL).searchParams.has('q')).toBe(false)
  })
})

describe('loadIndex', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Each test below uses its own URL so the module-level cache/in-flight
  // promise from one test can never be mistaken for another's.

  it('caches the response and does not refetch the same URL', async () => {
    const entries = [{ slug: 'caches-test' }] as never[]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(entries)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await loadIndex('/grantee-search-index-cache-test.json')
    const second = await loadIndex('/grantee-search-index-cache-test.json')

    expect(first).toBe(entries)
    expect(second).toBe(entries)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent calls for the same URL into one fetch', async () => {
    let resolveResponse!: (value: unknown) => void
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(responsePromise)
    vi.stubGlobal('fetch', fetchMock)

    const call1 = loadIndex('/grantee-search-index-dedupe-test.json')
    const call2 = loadIndex('/grantee-search-index-dedupe-test.json')

    resolveResponse({ ok: true, json: () => Promise.resolve([]) })
    await Promise.all([call1, call2])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )

    await expect(
      loadIndex('/grantee-search-index-error-test.json')
    ).rejects.toThrow('Failed to load grantee search index: 500')
  })
})
