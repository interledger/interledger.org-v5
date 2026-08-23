import { matchesGranteeFilters } from '@/utils/main/granteeFilters'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import { createSearchResultRow } from './grantee-search-result'

// Not the `@/utils` barrel (astro:content) and not grantee.ts (createExcerpt /
// markdown-it). matchesGranteeFilters is the client-safe filter; the search
// entry type is erased at compile time.

const DEBOUNCE_MS = 200
const QUERY_PARAM = 'q'

let cachedIndex: GranteeSearchEntry[] | null = null
let cachedIndexUrl: string | null = null
let fetchPromise: Promise<GranteeSearchEntry[]> | null = null

async function loadIndex(url: string): Promise<GranteeSearchEntry[]> {
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

function updateUrlQuery(query: string) {
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

function initGranteeSearch(): void {
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

  function setResultsCount(count: number) {
    resultsCount.textContent = resultsTemplate.replace('{count}', String(count))
  }

  function showStatic() {
    staticList.hidden = initialStaticHidden
    emptyState.hidden = initialEmptyHidden
    if (pagination) pagination.hidden = false
    searchResults.hidden = true
    searchResults.replaceChildren()
    resultsCount.textContent = initialResultsText
  }

  function showSearchResults(entries: GranteeSearchEntry[]) {
    staticList.hidden = true
    if (pagination) pagination.hidden = true
    searchResults.replaceChildren(
      ...entries.map((entry) =>
        createSearchResultRow(entry, rowTemplate, tagTemplate)
      )
    )
    const hasResults = entries.length > 0
    searchResults.hidden = !hasResults
    emptyState.hidden = hasResults
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
      trackSearch(query.trim())
    }, DEBOUNCE_MS)
  }

  input.addEventListener('input', () => {
    scheduleSearch(input.value)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      event.preventDefault()
      input.value = ''
      window.clearTimeout(debounceHandle)
      showStatic()
      updateUrlQuery('')
    }
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

  const initialQuery = new URL(window.location.href).searchParams.get(
    QUERY_PARAM
  )
  if (initialQuery) {
    input.value = initialQuery
    void runSearch(initialQuery)
  }
}

initGranteeSearch()
