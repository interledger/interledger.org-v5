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

/** Where a filter link's pristine, query-free href is stashed. */
const ORIGINAL_HREF_ATTR = 'data-blog-search-original-href'

/**
 * Derive a filter href from a stable original. An empty query restores
 * `originalHref`; a non-empty one always starts from that same original, so a
 * previous `?q=` can never compound or stick after a modified-click.
 * Cross-origin hrefs are left alone.
 */
export function hrefFromOriginal(
  originalHref: string,
  query: string,
  pageOrigin: string
): string {
  const trimmed = query.trim()
  if (!trimmed) return originalHref

  const url = new URL(originalHref, pageOrigin)
  if (url.origin !== new URL(pageOrigin).origin) return originalHref
  url.searchParams.set(QUERY_PARAM, trimmed)
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Rewrite the category-pill and content-language hrefs inside the search root
 * so they carry the live query. Runs as the input changes rather than on
 * click, so modified-click, copy-link and the context menu all see the same
 * URL the user would get from a plain click. Pills that TaxonomyFilter
 * rendered disabled have no `href`, so the selector skips them. Pagination
 * lives outside the root and is hidden during search, so it is not wired.
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

export function initBlogSearch(): void {
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
  const searchStatus = document.querySelector<HTMLElement>(
    '[data-blog-search-status]'
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
  // Raw category term, absent on /category/all and on term-fallback pages
  // (where the static list itself shows every post for the language).
  const category = root.dataset.selectedCategory || undefined
  const categoryLabels = JSON.parse(
    root.dataset.categoryLabels ?? '{}'
  ) as Record<string, string>

  const initialStaticHidden = staticList.hidden
  const initialEmptyHidden = emptyState.hidden
  const resultsTemplate = searchCount?.dataset.resultsTemplate ?? '{count}'
  // Server-rendered and never changes; read once so the announcement and the
  // visible empty state can't drift apart.
  const emptyMessage = emptyState.textContent?.trim() ?? ''

  let debounceHandle: number | undefined
  let requestId = 0
  let lastTrackedQuery = ''

  function trackCommittedSearch() {
    const trimmed = input.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  function syncFilterHrefs() {
    syncSearchHrefs(searchRoot, input.value, window.location.origin)
  }

  /**
   * Replace the text of the `sr-only` live region.
   *
   * It is deliberately a separate node from the visible count, and is never
   * toggled with `hidden`: Tailwind's preflight makes `[hidden]` `display:
   * none !important`, and text written into a `display: none` node never
   * reaches the accessibility tree, so a live region that is hidden while
   * being written announces nothing. `sr-only` clips the node instead of
   * removing it, which keeps it announceable.
   *
   * An unchanged message is left alone: writing the same text is a no-op for
   * screen readers anyway, and re-announcing an identical count is just noise.
   */
  function announce(message: string) {
    if (!searchStatus || searchStatus.textContent === message) return
    searchStatus.textContent = message
  }

  function showStatic() {
    staticList.hidden = initialStaticHidden
    emptyState.hidden = initialEmptyHidden
    searchResults.hidden = true
    searchResults.replaceChildren()
    if (langNotice) langNotice.hidden = false
    if (searchCount) searchCount.hidden = true
    if (pagination) pagination.hidden = false
    // Nothing to report while browsing; also lets the next search announce
    // even if it lands on the same count as the previous one.
    announce('')
  }

  // Applied as soon as a non-empty query starts a search (before the index
  // fetch resolves), not just once results render — otherwise the static list
  // and pagination stay visible for the debounce+fetch window of the first
  // search, and Prev/Next would navigate away without `?q=`.
  function enterSearchMode() {
    staticList.hidden = true
    if (langNotice) langNotice.hidden = true
    if (pagination) pagination.hidden = true
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

    const countMessage = resultsTemplate.replace(
      '{count}',
      String(entries.length)
    )
    if (searchCount) {
      // Unhide before writing, so the text is never set on a `display: none`
      // node — harmless for this visual-only node today, but it keeps the
      // ordering correct if a live region is ever attached to it again.
      searchCount.hidden = false
      searchCount.textContent = countMessage
    }

    // A zero-result search is the case most worth hearing about, and the
    // visible empty-state copy is more useful than "0 Results" — reuse it
    // rather than duplicating the string.
    announce(hasResults ? countMessage : emptyMessage || countMessage)
  }

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      showStatic()
      return
    }

    // Enter search mode (hide the static list and pagination) as soon as we
    // know we're searching — not only once results render — so the chrome
    // doesn't stay live during the debounce+fetch window of the first search.
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
      matchesBlogSearch(entry, { q: trimmed, lang, category })
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
    // Ahead of the debounce, so a click landing mid-debounce still carries
    // the query the user can see in the field.
    syncFilterHrefs()
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
      syncFilterHrefs()
    }
  })

  input.addEventListener('blur', () => {
    trackCommittedSearch()
  })

  const initialQuery = new URL(window.location.href).searchParams.get(
    QUERY_PARAM
  )
  if (initialQuery) {
    input.value = initialQuery
    void runSearch(initialQuery)
  }
  // After hydration, so a deep-linked `?q=` is already on the filter links
  // before the first click.
  syncFilterHrefs()
}
