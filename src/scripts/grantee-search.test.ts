import { describe, expect, it, vi, afterEach } from 'vitest'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import {
  computeSearchViewState,
  formatResultsCount,
  loadIndex,
  parseGranteeSearchIndex,
  parseInitialQuery,
  updateUrlQuery
} from './grantee-search'

function sampleSearchEntry(
  overrides: Partial<GranteeSearchEntry> = {}
): GranteeSearchEntry {
  return {
    id: 'rec1',
    name: 'Test',
    program: '',
    year: '2024',
    country: '',
    startMonth: '',
    startLabel: '',
    leaders: [],
    tags: [],
    descriptionSnippet: null,
    projectUrl: null,
    budgetLabel: null,
    searchText: 'test',
    ...overrides
  }
}

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
      paginationHidden: false,
      errorHidden: true,
      countHidden: false,
      searchingHidden: true,
      rootBusy: false
    })
  })

  it('shows results and hides pagination when a search has matches', () => {
    expect(
      computeSearchViewState({ mode: 'results', resultsCount: 3 })
    ).toEqual({
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: false,
      paginationHidden: true,
      errorHidden: true,
      countHidden: false,
      searchingHidden: true,
      rootBusy: false
    })
  })

  it('shows the empty state and hides pagination when a search has no matches', () => {
    expect(
      computeSearchViewState({ mode: 'results', resultsCount: 0 })
    ).toEqual({
      staticHidden: true,
      emptyHidden: false,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: true,
      countHidden: false,
      searchingHidden: true,
      rootBusy: false
    })
  })

  it('hides the static list and pagination while a search is in flight', () => {
    expect(computeSearchViewState({ mode: 'searching' })).toEqual({
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: true,
      countHidden: true,
      searchingHidden: false,
      rootBusy: true
    })
  })

  it('shows an error and hides the static list so a failed fetch is not mistaken for results', () => {
    expect(computeSearchViewState({ mode: 'error' })).toEqual({
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: false,
      countHidden: true,
      searchingHidden: true,
      rootBusy: false
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

describe('parseGranteeSearchIndex', () => {
  it('returns an Error when the payload is not an array', () => {
    expect(parseGranteeSearchIndex({ entries: [] })).toBeInstanceOf(Error)
  })

  it('returns an Error when an entry is missing required fields', () => {
    expect(parseGranteeSearchIndex([{ id: 'rec1' }])).toBeInstanceOf(Error)
  })

  it('returns typed entries when the payload is valid', () => {
    const entry = sampleSearchEntry({ name: 'Clearing House' })
    expect(parseGranteeSearchIndex([entry])).toEqual([entry])
  })
})

describe('loadIndex', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Each test below uses its own URL so the module-level cache/in-flight
  // promise from one test can never be mistaken for another's.

  it('caches the response and does not refetch the same URL', async () => {
    const entries = [sampleSearchEntry({ id: 'cache' })]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(entries)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await loadIndex('/grantee-search-index-cache-test.json')
    const second = await loadIndex('/grantee-search-index-cache-test.json')

    expect(first).toEqual(entries)
    expect(second).toBe(first)
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

  it('returns an Error when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )

    const result = await loadIndex('/grantee-search-index-error-test.json')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('500')
  })

  it('returns an Error when the JSON is not a valid index', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 'incomplete' }])
      })
    )

    const result = await loadIndex('/grantee-search-index-invalid-test.json')
    expect(result).toBeInstanceOf(Error)
  })

  it('does not reuse an in-flight fetch for a different URL', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([sampleSearchEntry({ id: url })])
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      loadIndex('/grantee-search-index-en.json'),
      loadIndex('/grantee-search-index-es.json')
    ])

    expect(first).toEqual([
      sampleSearchEntry({ id: '/grantee-search-index-en.json' })
    ])
    expect(second).toEqual([
      sampleSearchEntry({ id: '/grantee-search-index-es.json' })
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
