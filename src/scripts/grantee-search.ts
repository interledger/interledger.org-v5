import { matchesGranteeFilters } from '@/utils/main/granteeFilters'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import { tryCatchAsync } from '@/utils/shared/tryCatch'
import {
  createSearchResultRow,
  hrefWithPreservedSearch,
  type SearchResultContext
} from './grantee-search-result'

// Not the `@/utils` barrel (astro:content) and not grantee.ts (createExcerpt /
// markdown-it). matchesGranteeFilters is the client-safe filter; the search
// entry type is erased at compile time.

const DEBOUNCE_MS = 200
const QUERY_PARAM = 'q'

const cachedIndexes = new Map<string, GranteeSearchEntry[]>()
const inflightIndexes = new Map<string, Promise<GranteeSearchEntry[] | Error>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isGranteeSearchEntry(value: unknown): value is GranteeSearchEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.program === 'string' &&
    typeof value.year === 'string' &&
    typeof value.country === 'string' &&
    typeof value.startMonth === 'string' &&
    typeof value.startLabel === 'string' &&
    typeof value.searchText === 'string' &&
    isStringArray(value.leaders) &&
    isStringArray(value.tags) &&
    isNullableString(value.descriptionSnippet) &&
    isNullableString(value.projectUrl) &&
    isNullableString(value.budgetLabel)
  )
}

export function parseGranteeSearchIndex(
  data: unknown
): GranteeSearchEntry[] | Error {
  if (!Array.isArray(data)) {
    return new Error('Grantee search index is not an array')
  }
  const entries: GranteeSearchEntry[] = []
  for (const item of data) {
    if (!isGranteeSearchEntry(item)) {
      return new Error('Grantee search index entry is missing required fields')
    }
    entries.push(item)
  }
  return entries
}

export async function loadIndex(
  url: string
): Promise<GranteeSearchEntry[] | Error> {
  const cached = cachedIndexes.get(url)
  if (cached) return cached

  const inflight = inflightIndexes.get(url)
  if (inflight) return inflight

  const request = (async () => {
    const fetched = await tryCatchAsync(async () => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          `Failed to load grantee search index: ${response.status}`
        )
      }
      return response.json()
    })
    if (fetched instanceof Error) return fetched
    const parsed = parseGranteeSearchIndex(fetched)
    if (parsed instanceof Error) return parsed
    cachedIndexes.set(url, parsed)
    return parsed
  })().finally(() => {
    inflightIndexes.delete(url)
  })

  inflightIndexes.set(url, request)
  return request
}

export function updateUrlQuery(query: string) {
  const url = new URL(window.location.href)
  if (query) {
    url.searchParams.set(QUERY_PARAM, query)
  } else {
    url.searchParams.delete(QUERY_PARAM)
  }
  window.history.replaceState(window.history.state, '', url)
}

function trackSearch(query: string) {
  if (!query) return
  window.umami?.track('grantee_search', { query })
}

/** URL's `?q=` value on load, or `''` when absent — drives initial search hydration. */
export function parseInitialQuery(href: string): string {
  return new URL(href).searchParams.get(QUERY_PARAM) ?? ''
}

/** Fills `{count}` in a results-count template, e.g. `"{count} grantees found"`. */
export function formatResultsCount(template: string, count: number): string {
  return template.replace('{count}', String(count))
}

export interface GranteeSearchViewState {
  staticHidden: boolean
  emptyHidden: boolean
  resultsHidden: boolean
  paginationHidden: boolean
  errorHidden: boolean
  countHidden: boolean
}

type GranteeSearchViewMode =
  | {
      mode: 'static'
      initialStaticHidden: boolean
      initialEmptyHidden: boolean
    }
  | { mode: 'searching' }
  | { mode: 'results'; resultsCount: number }
  | { mode: 'error' }

/**
 * What the static list, results list, empty state, error state, count, and
 * pagination should show for a given mode. Kept pure and separate from the
 * DOM writes in `showStatic`/`enterSearchMode`/`showSearchResults`/
 * `showSearchError` so the decision — e.g. that pagination hides as soon as
 * a search starts, then reappears at the page's original static/empty split
 * once the query is cleared — is testable without a DOM.
 */
export function computeSearchViewState(
  input: GranteeSearchViewMode
): GranteeSearchViewState {
  if (input.mode === 'static') {
    return {
      staticHidden: input.initialStaticHidden,
      emptyHidden: input.initialEmptyHidden,
      resultsHidden: true,
      paginationHidden: false,
      errorHidden: true,
      countHidden: false
    }
  }

  if (input.mode === 'searching') {
    return {
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: true,
      countHidden: true
    }
  }

  if (input.mode === 'error') {
    return {
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: false,
      countHidden: true
    }
  }

  const hasResults = input.resultsCount > 0
  return {
    staticHidden: true,
    emptyHidden: hasResults,
    resultsHidden: !hasResults,
    paginationHidden: true,
    errorHidden: true,
    countHidden: false
  }
}

interface SearchDom {
  root: HTMLElement
  input: HTMLInputElement
  staticList: HTMLElement
  searchResults: HTMLOListElement
  emptyState: HTMLElement
  searchError: HTMLElement
  resultsCount: HTMLElement
  pagination: HTMLElement | null
  rowTemplate: HTMLTemplateElement
  tagTemplate: HTMLTemplateElement
  indexUrl: string
}

function querySearchDom(): SearchDom | null {
  const root = document.querySelector<HTMLElement>('[data-grantee-search-root]')
  const input = document.getElementById('grantee-search')
  const staticList = document.querySelector<HTMLElement>('[data-grantee-list]')
  const searchResults = document.querySelector<HTMLOListElement>(
    '[data-grantee-search-results]'
  )
  const emptyState = document.querySelector<HTMLElement>('[data-grantee-empty]')
  const searchError = document.querySelector<HTMLElement>(
    '[data-grantee-search-error]'
  )
  const resultsCount = document.querySelector<HTMLElement>(
    '[data-grantee-results-count]'
  )
  const pagination = document.querySelector<HTMLElement>(
    '[data-grantee-pagination]'
  )
  const rowTemplate = document.getElementById('grantee-search-result-template')
  const tagTemplate = document.querySelector<HTMLTemplateElement>(
    '[data-grantee-search-tag-template]'
  )
  const indexUrl = root?.dataset.searchIndexUrl

  if (
    !root ||
    !(input instanceof HTMLInputElement) ||
    !staticList ||
    !searchResults ||
    !emptyState ||
    !searchError ||
    !resultsCount ||
    !(rowTemplate instanceof HTMLTemplateElement) ||
    !tagTemplate ||
    !indexUrl
  ) {
    return null
  }

  return {
    root,
    input,
    staticList,
    searchResults,
    emptyState,
    searchError,
    resultsCount,
    pagination,
    rowTemplate,
    tagTemplate,
    indexUrl
  }
}

export function initGranteeSearch(): void {
  const dom = querySearchDom()
  if (!dom) return
  wireGranteeSearch(dom)
}

function wireGranteeSearch(dom: SearchDom): void {
  const searchRoot = dom.root
  const searchInput = dom.input
  const searchStaticList = dom.staticList
  const searchResultsList = dom.searchResults
  const searchEmpty = dom.emptyState
  const searchErrorEl = dom.searchError
  const searchCount = dom.resultsCount
  const pagination = dom.pagination
  const searchRowTemplate = dom.rowTemplate
  const searchTagTemplate = dom.tagTemplate
  const searchIndexUrl = dom.indexUrl

  const year = searchRoot.dataset.selectedYear ?? ''
  const tag = searchRoot.dataset.selectedTag ?? ''
  const resultsTemplate = searchRoot.dataset.resultsTemplate ?? '{count}'

  const initialStaticHidden = searchStaticList.hidden
  const initialEmptyHidden = searchEmpty.hidden
  const initialResultsText = searchCount.textContent ?? ''

  let debounceHandle: number | undefined
  let requestId = 0
  let lastTrackedQuery = ''

  function trackCommittedSearch() {
    const trimmed = searchInput.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  function setResultsCount(count: number) {
    searchCount.textContent = formatResultsCount(resultsTemplate, count)
  }

  function applyViewState(state: GranteeSearchViewState) {
    searchStaticList.hidden = state.staticHidden
    searchEmpty.hidden = state.emptyHidden
    searchResultsList.hidden = state.resultsHidden
    searchErrorEl.hidden = state.errorHidden
    searchCount.hidden = state.countHidden
    if (pagination) pagination.hidden = state.paginationHidden
  }

  function showStatic() {
    applyViewState(
      computeSearchViewState({
        mode: 'static',
        initialStaticHidden,
        initialEmptyHidden
      })
    )
    searchResultsList.replaceChildren()
    searchCount.textContent = initialResultsText
  }

  function enterSearchMode() {
    applyViewState(computeSearchViewState({ mode: 'searching' }))
  }

  function showSearchError() {
    searchResultsList.replaceChildren()
    applyViewState(computeSearchViewState({ mode: 'error' }))
  }

  function searchResultContext(): SearchResultContext {
    return {
      directoryPath: searchRoot.dataset.directoryPath ?? '',
      selectedYear: year,
      searchQuery: searchInput.value.trim(),
      pathname: searchRoot.dataset.pathname ?? window.location.pathname,
      lang: searchRoot.dataset.lang ?? '',
      viewDetailsLabel: searchRoot.dataset.labelViewDetails ?? ''
    }
  }

  function showSearchResults(entries: GranteeSearchEntry[]) {
    const context = searchResultContext()
    searchResultsList.replaceChildren(
      ...entries.map((entry) =>
        createSearchResultRow(
          entry,
          searchRowTemplate,
          searchTagTemplate,
          context
        )
      )
    )
    applyViewState(
      computeSearchViewState({ mode: 'results', resultsCount: entries.length })
    )
    setResultsCount(entries.length)
  }

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      showStatic()
      return
    }

    enterSearchMode()

    const index = await loadIndex(searchIndexUrl)
    if (myRequestId !== requestId || searchInput.value.trim() !== trimmed)
      return
    if (index instanceof Error) {
      showSearchError()
      return
    }

    const matches = index.filter((entry) =>
      matchesGranteeFilters(entry, { q: trimmed, year, tag })
    )
    try {
      showSearchResults(matches)
    } catch {
      if (myRequestId !== requestId || searchInput.value.trim() !== trimmed)
        return
      showSearchError()
    }
  }

  function scheduleSearch(query: string) {
    window.clearTimeout(debounceHandle)
    debounceHandle = window.setTimeout(() => {
      void runSearch(query)
      updateUrlQuery(query.trim())
    }, DEBOUNCE_MS)
  }

  searchInput.addEventListener('input', () => {
    // Hide pagination immediately so Prev/Next (outside the search root)
    // cannot navigate away without `?q=` during the debounce window.
    if (searchInput.value.trim()) enterSearchMode()
    scheduleSearch(searchInput.value)
  })

  // Analytics on commit (Enter/blur), not each debounce, so Umami does not
  // store a typing transcript.
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      trackCommittedSearch()
      return
    }
    if (event.key === 'Escape' && searchInput.value) {
      event.preventDefault()
      searchInput.value = ''
      lastTrackedQuery = ''
      window.clearTimeout(debounceHandle)
      // Drop the in-flight generation so a late-failing fetch cannot paint
      // the error view over the static list.
      requestId++
      showStatic()
      updateUrlQuery('')
    }
  })

  searchInput.addEventListener('blur', () => {
    trackCommittedSearch()
  })

  function preserveSearchOnClick(event: MouseEvent) {
    if (event.defaultPrevented) return
    // 0 = primary, 1 = middle (auxclick). Ignore right-click.
    if (event.button !== 0 && event.button !== 1) return

    const target = event.target as Element | null
    const link = target?.closest('a[href]')
    if (!(link instanceof HTMLAnchorElement)) return
    if (!searchRoot.contains(link) && !pagination?.contains(link)) return

    const query = searchInput.value.trim()
    if (!query) return

    // Rewrite the href and let the browser navigate (including Ctrl/Cmd/Shift
    // new-tab). preventDefault + assign dropped `?q=` on modified clicks.
    link.href = hrefWithPreservedSearch(
      link.href,
      query,
      window.location.origin
    )
  }

  searchRoot.addEventListener('click', preserveSearchOnClick)
  searchRoot.addEventListener('auxclick', preserveSearchOnClick)
  pagination?.addEventListener('click', preserveSearchOnClick)
  pagination?.addEventListener('auxclick', preserveSearchOnClick)

  const initialQuery = parseInitialQuery(window.location.href)
  if (initialQuery) {
    searchInput.value = initialQuery
    void runSearch(initialQuery)
  }
}
