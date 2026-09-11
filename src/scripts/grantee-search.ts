import { matchesGranteeFilters } from '@/utils/main/granteeFilters'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import { tryCatchAsync } from '@/utils/shared/tryCatch'
import {
  createSearchResultRow,
  hrefFromOriginal,
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
  searchingHidden: boolean
  rootBusy: boolean
}

type GranteeSearchViewMode =
  | {
      mode: 'static'
      initialStaticHidden: boolean
      initialEmptyHidden: boolean
    }
  | { mode: 'searching' }
  | { mode: 'results'; resultsCount: number }
  | {
      mode: 'error'
      initialStaticHidden: boolean
      initialEmptyHidden: boolean
    }

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
      countHidden: false,
      searchingHidden: true,
      rootBusy: false
    }
  }

  if (input.mode === 'searching') {
    return {
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      paginationHidden: true,
      errorHidden: true,
      countHidden: true,
      searchingHidden: false,
      rootBusy: true
    }
  }

  if (input.mode === 'error') {
    return {
      staticHidden: input.initialStaticHidden,
      emptyHidden: input.initialEmptyHidden,
      resultsHidden: true,
      paginationHidden: false,
      errorHidden: false,
      countHidden: false,
      searchingHidden: true,
      rootBusy: false
    }
  }

  const hasResults = input.resultsCount > 0
  return {
    staticHidden: true,
    emptyHidden: hasResults,
    resultsHidden: !hasResults,
    paginationHidden: true,
    errorHidden: true,
    countHidden: false,
    searchingHidden: true,
    rootBusy: false
  }
}

interface SearchDom {
  root: HTMLElement
  input: HTMLInputElement
  staticList: HTMLElement
  searchResults: HTMLOListElement
  emptyState: HTMLElement
  searchError: HTMLElement
  searchingStatus: HTMLElement
  resultsCount: HTMLElement
  clearButton: HTMLButtonElement
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
  const searchingStatus = document.querySelector<HTMLElement>(
    '[data-grantee-searching]'
  )
  const clearButton = document.querySelector<HTMLButtonElement>(
    '[data-grantee-search-clear]'
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
    !searchingStatus ||
    !(clearButton instanceof HTMLButtonElement) ||
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
    searchingStatus,
    clearButton,
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

interface SearchViewConfig {
  resultsTemplate: string
  initialStaticHidden: boolean
  initialEmptyHidden: boolean
  initialResultsText: string
}

interface SearchView {
  showStatic(): void
  enterSearchMode(): void
  showSearchError(): void
  showSearchResults(
    entries: GranteeSearchEntry[],
    context: SearchResultContext
  ): void
}

/** Owns the DOM writes for the static/searching/results/error states. */
function createSearchView(
  dom: SearchDom,
  config: SearchViewConfig
): SearchView {
  const {
    root,
    staticList,
    searchResults,
    emptyState,
    searchError,
    searchingStatus,
    resultsCount,
    pagination,
    rowTemplate,
    tagTemplate
  } = dom

  function setResultsCount(count: number) {
    resultsCount.textContent = formatResultsCount(config.resultsTemplate, count)
  }

  function applyViewState(state: GranteeSearchViewState) {
    staticList.hidden = state.staticHidden
    emptyState.hidden = state.emptyHidden
    searchResults.hidden = state.resultsHidden
    searchError.hidden = state.errorHidden
    searchingStatus.hidden = state.searchingHidden
    resultsCount.hidden = state.countHidden
    if (pagination) pagination.hidden = state.paginationHidden
    root.setAttribute('aria-busy', state.rootBusy ? 'true' : 'false')
  }

  function showStatic() {
    applyViewState(
      computeSearchViewState({
        mode: 'static',
        initialStaticHidden: config.initialStaticHidden,
        initialEmptyHidden: config.initialEmptyHidden
      })
    )
    searchResults.replaceChildren()
    resultsCount.textContent = config.initialResultsText
  }

  function enterSearchMode() {
    applyViewState(computeSearchViewState({ mode: 'searching' }))
  }

  function showSearchError() {
    searchResults.replaceChildren()
    resultsCount.textContent = config.initialResultsText
    applyViewState(
      computeSearchViewState({
        mode: 'error',
        initialStaticHidden: config.initialStaticHidden,
        initialEmptyHidden: config.initialEmptyHidden
      })
    )
  }

  function showSearchResults(
    entries: GranteeSearchEntry[],
    context: SearchResultContext
  ) {
    searchResults.replaceChildren(
      ...entries.map((entry) =>
        createSearchResultRow(entry, rowTemplate, tagTemplate, context)
      )
    )
    applyViewState(
      computeSearchViewState({ mode: 'results', resultsCount: entries.length })
    )
    setResultsCount(entries.length)
  }

  return { showStatic, enterSearchMode, showSearchError, showSearchResults }
}

interface SearchControllerConfig {
  indexUrl: string
  year: string
  tag: string
  view: SearchView
  buildContext: (query: string) => SearchResultContext
  /** Live input value, re-read after each await to detect a stale response. */
  getInputValue: () => string
}

interface SearchController {
  runSearch(query: string): Promise<void>
  scheduleSearch(query: string): void
  cancelScheduled(): void
}

/** Owns debouncing, request-generation tracking, and filtering against the index. */
export function createSearchController(
  config: SearchControllerConfig
): SearchController {
  let debounceHandle: number | undefined
  let requestId = 0

  function isStale(myRequestId: number, trimmed: string): boolean {
    return (
      myRequestId !== requestId || config.getInputValue().trim() !== trimmed
    )
  }

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      config.view.showStatic()
      return
    }

    config.view.enterSearchMode()

    const index = await loadIndex(config.indexUrl)
    if (isStale(myRequestId, trimmed)) return
    if (index instanceof Error) {
      config.view.showSearchError()
      return
    }

    const matches = index.filter((entry) =>
      matchesGranteeFilters(entry, {
        q: trimmed,
        year: config.year,
        tag: config.tag
      })
    )
    try {
      config.view.showSearchResults(matches, config.buildContext(trimmed))
    } catch {
      if (isStale(myRequestId, trimmed)) return
      config.view.showSearchError()
    }
  }

  function scheduleSearch(query: string) {
    window.clearTimeout(debounceHandle)
    debounceHandle = window.setTimeout(() => {
      void runSearch(query)
      updateUrlQuery(query.trim())
    }, DEBOUNCE_MS)
  }

  function cancelScheduled() {
    window.clearTimeout(debounceHandle)
    // Drop the in-flight generation so a late-failing fetch cannot paint
    // the error view over the static list.
    requestId++
  }

  return { runSearch, scheduleSearch, cancelScheduled }
}

const ORIGINAL_HREF_ATTR = 'data-grantee-original-href'

/**
 * Rewrite year/tag filter hrefs from a stored original so `?q=` cannot stick
 * after a modified-click. Pagination is hidden whenever `q` is non-empty, so
 * it is not wired. Copy-link / context-menu see the live query because this
 * runs as the input changes, not on click.
 */
export function syncSearchHrefs(
  root: ParentNode,
  query: string,
  pageOrigin: string
): void {
  for (const node of root.querySelectorAll('a[href]')) {
    if (!(node instanceof HTMLAnchorElement)) continue
    let original = node.getAttribute(ORIGINAL_HREF_ATTR)
    if (original === null) {
      original = node.getAttribute('href') ?? ''
      node.setAttribute(ORIGINAL_HREF_ATTR, original)
    }
    node.setAttribute('href', hrefFromOriginal(original, query, pageOrigin))
  }
}

function wireGranteeSearch(dom: SearchDom): void {
  const { root: searchRoot, input: searchInput, clearButton } = dom
  const year = searchRoot.dataset.selectedYear ?? ''
  const tag = searchRoot.dataset.selectedTag ?? ''

  const view = createSearchView(dom, {
    resultsTemplate: searchRoot.dataset.resultsTemplate ?? '{count}',
    initialStaticHidden: dom.staticList.hidden,
    initialEmptyHidden: dom.emptyState.hidden,
    initialResultsText: dom.resultsCount.textContent ?? ''
  })

  function buildContext(query: string): SearchResultContext {
    return {
      directoryPath: searchRoot.dataset.directoryPath ?? '',
      selectedYear: year,
      searchQuery: query,
      pathname: searchRoot.dataset.pathname ?? window.location.pathname,
      lang: searchRoot.dataset.lang ?? '',
      viewDetailsLabel: searchRoot.dataset.labelViewDetails ?? ''
    }
  }

  const controller = createSearchController({
    indexUrl: dom.indexUrl,
    year,
    tag,
    view,
    buildContext,
    getInputValue: () => searchInput.value
  })

  let lastTrackedQuery = ''
  function trackCommittedSearch() {
    const trimmed = searchInput.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  function syncClearButton() {
    clearButton.hidden = !searchInput.value
  }

  function syncFilterHrefs() {
    syncSearchHrefs(searchRoot, searchInput.value, window.location.origin)
  }

  function clearSearch() {
    searchInput.value = ''
    lastTrackedQuery = ''
    controller.cancelScheduled()
    view.showStatic()
    updateUrlQuery('')
    syncFilterHrefs()
    syncClearButton()
    searchInput.focus()
  }

  searchInput.addEventListener('input', () => {
    // Hide the static list and pagination immediately. Search results are
    // not paged; leaving Prev/Next up during debounce would navigate without
    // `?q=`.
    if (searchInput.value.trim()) view.enterSearchMode()
    controller.scheduleSearch(searchInput.value)
    syncFilterHrefs()
    syncClearButton()
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
      clearSearch()
    }
  })

  clearButton.addEventListener('click', () => {
    clearSearch()
  })

  searchInput.addEventListener('blur', () => {
    trackCommittedSearch()
  })

  const initialQuery = parseInitialQuery(window.location.href)
  if (initialQuery) {
    searchInput.value = initialQuery
    void controller.runSearch(initialQuery)
  }
  syncFilterHrefs()
  syncClearButton()
}
