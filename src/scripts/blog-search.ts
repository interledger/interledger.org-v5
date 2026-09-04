import { matchesBlogSearch } from '@/utils/main/blogSearchFilters'
import type { BlogSearchEntry } from '@/utils/main/blogSearch'
import type { Locale } from '@/utils/main/locales'
import {
  createSearchResultRow,
  type SearchResultContext
} from './blog-search-result'

// Not the `@/utils` barrel (astro:content) and not blogSearch.ts
// (createExcerpt/markdown-it). matchesBlogSearch is the client-safe filter;
// the search entry type is erased at compile time.

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string>) => void }
  }
}

const DEBOUNCE_MS = 200
const QUERY_PARAM = 'q'

const indexCache = new Map<string, BlogSearchEntry[]>()
const indexFetches = new Map<string, Promise<BlogSearchEntry[]>>()

async function loadIndex(url: string): Promise<BlogSearchEntry[]> {
  const cached = indexCache.get(url)
  if (cached) return cached

  let fetchPromise = indexFetches.get(url)
  if (!fetchPromise) {
    fetchPromise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load blog search index: ${response.status}`
          )
        }
        return response.json() as Promise<BlogSearchEntry[]>
      })
      .then((entries) => {
        indexCache.set(url, entries)
        return entries
      })
      .finally(() => {
        indexFetches.delete(url)
      })
    indexFetches.set(url, fetchPromise)
  }

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
  window.umami?.track('blog_search', { query })
}

function initBlogSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-blog-search-root]')
  const input = document.getElementById('blog-search')
  const staticList = document.querySelector<HTMLElement>('[data-blog-list]')
  const searchResults = document.querySelector<HTMLOListElement>(
    '[data-blog-search-results]'
  )
  const emptyState = document.querySelector<HTMLElement>(
    '[data-blog-search-empty]'
  )
  const langNotice = document.querySelector<HTMLElement>(
    '[data-blog-lang-notice]'
  )
  const searchCount = document.querySelector<HTMLElement>(
    '[data-blog-search-count]'
  )
  const taxonomyFilter = document.querySelector<HTMLElement>(
    '[data-blog-taxonomy-filter]'
  )
  const pagination = document.querySelector<HTMLElement>(
    '[data-blog-pagination]'
  )
  const rowTemplate = document.getElementById('blog-search-result-template')
  const categoryTemplate = document.querySelector<HTMLTemplateElement>(
    '[data-blog-search-category-template]'
  )

  if (
    !root ||
    !(input instanceof HTMLInputElement) ||
    !staticList ||
    !searchResults ||
    !emptyState ||
    !(rowTemplate instanceof HTMLTemplateElement) ||
    !categoryTemplate
  ) {
    return
  }

  // Captured non-null so nested function declarations (e.g.
  // searchResultContext) don't re-trigger the null check on `root`.
  const searchRoot = root

  const indexUrl = root.dataset.searchIndexUrl
  if (!indexUrl) return

  const lang = (root.dataset.selectedContentLang ?? '') as Locale
  const categoryLabels = JSON.parse(
    root.dataset.categoryLabels ?? '{}'
  ) as Record<string, string>

  const initialStaticHidden = staticList.hidden
  const initialEmptyHidden = emptyState.hidden
  const resultsTemplate = searchCount?.dataset.resultsTemplate ?? '{count}'

  let debounceHandle: number | undefined
  let requestId = 0
  let lastTrackedQuery = ''

  function trackCommittedSearch() {
    const trimmed = input.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  // Category pills don't apply during search — go inert the same way
  // TaxonomyFilter already disables a term with no posts in the selected
  // language (see TaxonomyFilter.astro/PillLink.astro): drop `href` so the
  // anchor has no default action or focus stop, and set `aria-disabled`,
  // which PillLink's own CSS already styles as greyed-out.
  function setTaxonomyInert(inert: boolean) {
    if (!taxonomyFilter) return
    taxonomyFilter.querySelectorAll('a').forEach((link) => {
      if (inert) {
        const href = link.getAttribute('href')
        if (href) link.dataset.blogSearchHref = href
        link.removeAttribute('href')
        link.setAttribute('aria-disabled', 'true')
      } else {
        const href = link.dataset.blogSearchHref
        if (href) link.setAttribute('href', href)
        delete link.dataset.blogSearchHref
        link.removeAttribute('aria-disabled')
      }
    })
  }

  function showStatic() {
    staticList.hidden = initialStaticHidden
    emptyState.hidden = initialEmptyHidden
    searchResults.hidden = true
    searchResults.replaceChildren()
    if (langNotice) langNotice.hidden = false
    if (searchCount) searchCount.hidden = true
    if (pagination) pagination.hidden = false
    setTaxonomyInert(false)
  }

  // Applied as soon as a non-empty query starts a search (before the index
  // fetch resolves), not just once results render — otherwise pagination and
  // the category pills stay live/visible for the debounce+fetch window of
  // the first search.
  function enterSearchMode() {
    staticList.hidden = true
    if (langNotice) langNotice.hidden = true
    if (pagination) pagination.hidden = true
    setTaxonomyInert(true)
  }

  function searchResultContext(): SearchResultContext {
    return {
      pathname: searchRoot.dataset.pathname ?? window.location.pathname,
      lang: (searchRoot.dataset.lang ?? lang) as Locale,
      categoryLabels
    }
  }

  function showSearchResults(entries: BlogSearchEntry[]) {
    const context = searchResultContext()
    searchResults.replaceChildren(
      ...entries.map((entry) =>
        createSearchResultRow(entry, rowTemplate, categoryTemplate, context)
      )
    )
    const hasResults = entries.length > 0
    searchResults.hidden = !hasResults
    emptyState.hidden = hasResults
    if (searchCount) {
      searchCount.textContent = resultsTemplate.replace(
        '{count}',
        String(entries.length)
      )
      searchCount.hidden = false
    }
  }

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      showStatic()
      return
    }

    // Enter search mode (hide pagination, disable category pills, hide the
    // static list) as soon as we know we're searching — not only once
    // results render — so the chrome doesn't stay live during the
    // debounce+fetch window of the first search.
    enterSearchMode()

    let index: BlogSearchEntry[]
    try {
      index = await loadIndex(indexUrl)
    } catch {
      // Fail closed: revert to the static, JS-independent listing rather
      // than leaving the page with nothing shown.
      if (myRequestId === requestId) showStatic()
      return
    }

    if (myRequestId !== requestId || input.value.trim() !== trimmed) return

    const matches = index.filter((entry) =>
      matchesBlogSearch(entry, { q: trimmed, lang })
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

  // Category pills go inert during search, so this delegated handler only
  // ever fires for links that remain clickable while searching — i.e. the
  // ContentLangFilter EN/ES links — carrying the live query forward.
  root.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const target = event.target as Element | null
    const link = target?.closest('a[href]')
    if (
      !(link instanceof HTMLAnchorElement) ||
      !root.contains(link) ||
      link.getAttribute('aria-disabled') === 'true'
    ) {
      return
    }

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

initBlogSearch()
