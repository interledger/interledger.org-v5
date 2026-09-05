import { matchesGranteeFilters } from '@/utils/main/granteeFilters'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import {
  createSearchResultRow,
  type SearchResultContext
} from './grantee-search-result'

// Not the `@/utils` barrel (astro:content) and not grantee.ts (createExcerpt /
// markdown-it). matchesGranteeFilters is the client-safe filter; the search
// entry type is erased at compile time.

const DEBOUNCE_MS = 200
const QUERY_PARAM = 'q'

let cachedIndex: GranteeSearchEntry[] | null = null
let cachedIndexUrl: string | null = null
let fetchPromise: Promise<GranteeSearchEntry[]> | null = null

export async function loadIndex(url: string): Promise<GranteeSearchEntry[]> {
  if (cachedIndex && cachedIndexUrl === url) return cachedIndex

  fetchPromise ??= fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load grantee search index: ${response.status}`
        )
      }
      return response.json() as Promise<GranteeSearchEntry[]>
    })
    .then((entries) => {
      cachedIndex = entries
      cachedIndexUrl = url
      return entries
    })
    .finally(() => {
      fetchPromise = null
    })

  return fetchPromise
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
}

type GranteeSearchViewMode =
  | {
      mode: 'static'
      initialStaticHidden: boolean
      initialEmptyHidden: boolean
    }
  | { mode: 'results'; resultsCount: number }

/**
 * What the static list, results list, empty state, and pagination should show
 * for a given mode. Kept pure and separate from the DOM writes in
 * `showStatic`/`showSearchResults` so the decision — e.g. that pagination
 * hides during a search but reappears at the page's original static/empty
 * split once the query is cleared — is testable without a DOM.
 */
export function computeSearchViewState(
  input: GranteeSearchViewMode
): GranteeSearchViewState {
  if (input.mode === 'static') {
    return {
      staticHidden: input.initialStaticHidden,
      emptyHidden: input.initialEmptyHidden,
      resultsHidden: true,
      paginationHidden: false
    }
  }

  const hasResults = input.resultsCount > 0
  return {
    staticHidden: true,
    emptyHidden: hasResults,
    resultsHidden: !hasResults,
    paginationHidden: true
  }
}

export function initGranteeSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-grantee-search-root]')
  const input = document.getElementById('grantee-search')
  const staticList = document.querySelector<HTMLElement>('[data-grantee-list]')
  const searchResults = document.querySelector<HTMLOListElement>(
    '[data-grantee-search-results]'
  )
  const emptyState = document.querySelector<HTMLElement>('[data-grantee-empty]')
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

  if (
    !root ||
    !(input instanceof HTMLInputElement) ||
    !staticList ||
    !searchResults ||
    !emptyState ||
    !resultsCount ||
    !(rowTemplate instanceof HTMLTemplateElement) ||
    !tagTemplate
  ) {
    return
  }

  const indexUrl = root.dataset.searchIndexUrl
  if (!indexUrl) return

  const year = root.dataset.selectedYear ?? ''
  const tag = root.dataset.selectedTag ?? ''
  const resultsTemplate = root.dataset.resultsTemplate ?? '{count}'

  const initialStaticHidden = staticList.hidden
  const initialEmptyHidden = emptyState.hidden
  const initialResultsText = resultsCount.textContent ?? ''

  let debounceHandle: number | undefined
  let requestId = 0
  let lastTrackedQuery = ''

  function trackCommittedSearch() {
    const trimmed = input.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  function setResultsCount(count: number) {
    resultsCount.textContent = formatResultsCount(resultsTemplate, count)
  }

  function applyViewState(state: GranteeSearchViewState) {
    staticList.hidden = state.staticHidden
    emptyState.hidden = state.emptyHidden
    searchResults.hidden = state.resultsHidden
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
    searchResults.replaceChildren()
    resultsCount.textContent = initialResultsText
  }

  function searchResultContext(): SearchResultContext {
    return {
      directoryPath: root.dataset.directoryPath ?? '',
      selectedYear: year,
      searchQuery: input.value.trim(),
      pathname: root.dataset.pathname ?? window.location.pathname,
      lang: root.dataset.lang ?? '',
      viewDetailsLabel: root.dataset.labelViewDetails ?? ''
    }
  }

  function showSearchResults(entries: GranteeSearchEntry[]) {
    const context = searchResultContext()
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

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      showStatic()
      return
    }

    let index: GranteeSearchEntry[]
    try {
      index = await loadIndex(indexUrl)
    } catch {
      // Fail closed: leave whatever was already on screen rather than
      // throwing away the static, JS-independent listing underneath.
      return
    }

    if (myRequestId !== requestId || input.value.trim() !== trimmed) return

    const matches = index.filter((entry) =>
      matchesGranteeFilters(entry, { q: trimmed, year, tag })
    )
    showSearchResults(matches)
  }

  function scheduleSearch(query: string) {
    window.clearTimeout(debounceHandle)
    debounceHandle = window.setTimeout(() => {
      void runSearch(query)
      updateUrlQuery(query.trim())
    }, DEBOUNCE_MS)
  }

  input.addEventListener('input', () => {
    scheduleSearch(input.value)
  })

  // Analytics on commit (Enter/blur), not each debounce, so Umami does not
  // store a typing transcript.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      trackCommittedSearch()
      return
    }
    if (event.key === 'Escape' && input.value) {
      event.preventDefault()
      input.value = ''
      lastTrackedQuery = ''
      window.clearTimeout(debounceHandle)
      showStatic()
      updateUrlQuery('')
    }
  })

  input.addEventListener('blur', () => {
    trackCommittedSearch()
  })

  root.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const target = event.target as Element | null
    const link = target?.closest('a[href]')
    if (!(link instanceof HTMLAnchorElement) || !root.contains(link)) return

    const query = input.value.trim()
    if (!query) return

    const url = new URL(link.href)
    url.searchParams.set(QUERY_PARAM, query)
    event.preventDefault()
    window.location.assign(url.toString())
  })

  const initialQuery = parseInitialQuery(window.location.href)
  if (initialQuery) {
    input.value = initialQuery
    void runSearch(initialQuery)
  }
}
