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

/** Whether a search against `url` can resolve without a network round trip. */
function isIndexCached(url: string): boolean {
  return indexCache.has(url)
}

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

/** Every element the search touches, resolved once. */
interface BlogSearchDom {
  root: HTMLElement
  input: HTMLInputElement
  staticList: HTMLElement
  searchResults: HTMLOListElement
  emptyState: HTMLElement
  rowTemplate: HTMLTemplateElement
  categoryTemplate: HTMLTemplateElement
  langNotice: HTMLElement | null
  searchCount: HTMLElement | null
  searchStatus: HTMLElement | null
  pagination: HTMLElement | null
  resultsRegion: HTMLElement | null
  searchError: HTMLElement | null
  /** Only on a term-fallback route, where the static list is every post for
   * the language rather than the filtered term. */
  termFallbackNotice: HTMLElement | null
}

/** Resolves the search DOM, or null on a page that has no search on it. */
function collectSearchDom(): BlogSearchDom | null {
  const root = document.querySelector<HTMLElement>('[data-blog-search-root]')
  const input = document.getElementById('blog-search')
  const staticList = document.querySelector<HTMLElement>('[data-blog-list]')
  const searchResults = document.querySelector<HTMLOListElement>(
    '[data-blog-search-results]'
  )
  const emptyState = document.querySelector<HTMLElement>(
    '[data-blog-search-empty]'
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
    return null
  }

  return {
    root,
    input,
    staticList,
    searchResults,
    emptyState,
    rowTemplate,
    categoryTemplate,
    langNotice: document.querySelector('[data-blog-lang-notice]'),
    searchCount: document.querySelector('[data-blog-search-count]'),
    searchStatus: document.querySelector('[data-blog-search-status]'),
    pagination: document.querySelector('[data-blog-pagination]'),
    resultsRegion: document.querySelector('[data-blog-results-region]'),
    searchError: document.querySelector('[data-blog-search-error]'),
    termFallbackNotice: document.querySelector('[data-blog-term-fallback]')
  }
}

/** The page-load visibility the static listing returns to. */
interface StaticViewBaseline {
  initialStaticHidden: boolean
  initialEmptyHidden: boolean
}

export type BlogSearchViewMode =
  | ({ mode: 'static' } & StaticViewBaseline)
  | ({ mode: 'error' } & StaticViewBaseline)
  | { mode: 'searching'; awaitingFetch: boolean }
  | { mode: 'results'; resultCount: number }

export interface BlogSearchViewState {
  staticHidden: boolean
  emptyHidden: boolean
  resultsHidden: boolean
  countHidden: boolean
  errorHidden: boolean
  langNoticeHidden: boolean
  paginationHidden: boolean
  termFallbackHidden: boolean
  busy: boolean
}

/**
 * What each part of the listing should show in a given mode.
 *
 * Pure and separate from the DOM writes in `createSearchView` so the decisions
 * that are easy to get wrong — pagination hiding the moment a query starts
 * rather than when results land, the term-fallback notice travelling with the
 * static listing it describes, the empty state and the results list being
 * mutually exclusive — are testable without a DOM.
 */
export function computeSearchViewState(
  input: BlogSearchViewMode
): BlogSearchViewState {
  if (input.mode === 'static' || input.mode === 'error') {
    return {
      staticHidden: input.initialStaticHidden,
      emptyHidden: input.initialEmptyHidden,
      resultsHidden: true,
      countHidden: true,
      errorHidden: input.mode !== 'error',
      langNoticeHidden: false,
      paginationHidden: false,
      termFallbackHidden: false,
      busy: false
    }
  }

  if (input.mode === 'searching') {
    return {
      staticHidden: true,
      emptyHidden: true,
      resultsHidden: true,
      countHidden: true,
      errorHidden: true,
      langNoticeHidden: true,
      paginationHidden: true,
      termFallbackHidden: true,
      // Only a real fetch is worth marking busy; a cached filter resolves in
      // the same tick.
      busy: input.awaitingFetch
    }
  }

  const hasResults = input.resultCount > 0
  return {
    staticHidden: true,
    emptyHidden: hasResults,
    resultsHidden: !hasResults,
    countHidden: false,
    errorHidden: true,
    langNoticeHidden: true,
    paginationHidden: true,
    termFallbackHidden: true,
    busy: false
  }
}

interface SearchViewConfig extends StaticViewBaseline {
  resultsTemplate: string
  emptyMessage: string
  errorMessage: string
  searchingMessage: string
  lang: Locale
  categoryLabels: Record<string, string>
}

interface SearchView {
  showStatic(): void
  showSearching(awaitingFetch: boolean): void
  showResults(entries: BlogSearchEntry[]): void
  showError(): void
}

/** Owns every DOM write and every announcement. */
function createSearchView(
  dom: BlogSearchDom,
  config: SearchViewConfig
): SearchView {
  const baseline: StaticViewBaseline = {
    initialStaticHidden: config.initialStaticHidden,
    initialEmptyHidden: config.initialEmptyHidden
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
    const { searchStatus } = dom
    if (!searchStatus || searchStatus.textContent === message) return
    searchStatus.textContent = message
  }

  function applyViewState(state: BlogSearchViewState) {
    dom.staticList.hidden = state.staticHidden
    dom.emptyState.hidden = state.emptyHidden
    dom.searchResults.hidden = state.resultsHidden
    if (dom.searchCount) dom.searchCount.hidden = state.countHidden
    if (dom.searchError) dom.searchError.hidden = state.errorHidden
    if (dom.langNotice) dom.langNotice.hidden = state.langNoticeHidden
    if (dom.pagination) dom.pagination.hidden = state.paginationHidden
    if (dom.termFallbackNotice) {
      dom.termFallbackNotice.hidden = state.termFallbackHidden
    }
    // The live region sits outside this container on purpose: updates to a
    // live region inside an aria-busy element are held back until it clears.
    if (dom.resultsRegion) {
      if (state.busy) {
        dom.resultsRegion.setAttribute('aria-busy', 'true')
      } else {
        dom.resultsRegion.removeAttribute('aria-busy')
      }
    }
  }

  function resultContext(): SearchResultContext {
    return {
      pathname: dom.root.dataset.pathname ?? window.location.pathname,
      lang: (dom.root.dataset.lang ?? config.lang) as Locale,
      categoryLabels: config.categoryLabels
    }
  }

  return {
    showStatic() {
      applyViewState(computeSearchViewState({ mode: 'static', ...baseline }))
      dom.searchResults.replaceChildren()
      // Nothing to report while browsing; also lets the next search announce
      // even if it lands on the same count as the previous one.
      announce('')
    },

    showSearching(awaitingFetch: boolean) {
      applyViewState(
        computeSearchViewState({ mode: 'searching', awaitingFetch })
      )
      if (awaitingFetch) announce(config.searchingMessage)
    },

    showResults(entries: BlogSearchEntry[]) {
      const context = resultContext()
      dom.searchResults.replaceChildren(
        ...entries.map((entry) =>
          createSearchResultRow(
            entry,
            dom.rowTemplate,
            dom.categoryTemplate,
            context
          )
        )
      )
      applyViewState(
        computeSearchViewState({ mode: 'results', resultCount: entries.length })
      )

      const countMessage = config.resultsTemplate.replace(
        '{count}',
        String(entries.length)
      )
      if (dom.searchCount) dom.searchCount.textContent = countMessage
      // A zero-result search is the case most worth hearing about, and the
      // visible empty-state copy is more useful than "0 Results".
      announce(
        entries.length > 0 ? countMessage : config.emptyMessage || countMessage
      )
    },

    showError() {
      applyViewState(computeSearchViewState({ mode: 'error', ...baseline }))
      dom.searchResults.replaceChildren()
      announce(config.errorMessage)
    }
  }
}

interface SearchControllerConfig {
  indexUrl: string
  lang: Locale
  category: string | undefined
  view: SearchView
  getQuery: () => string
}

/** Owns debouncing, stale-response guarding, and filtering against the index. */
function createSearchController(config: SearchControllerConfig) {
  const { indexUrl, lang, category, view, getQuery } = config
  let debounceHandle: number | undefined
  let requestId = 0

  async function runSearch(query: string) {
    const trimmed = query.trim()
    const myRequestId = ++requestId

    if (!trimmed) {
      view.showStatic()
      return
    }

    // Enter search mode as soon as we know we're searching — not only once
    // results render — so the static list and pagination don't stay visible
    // through the debounce+fetch window of the first search, where Prev/Next
    // would navigate away without `?q=`.
    const awaitingFetch = !isIndexCached(indexUrl)
    view.showSearching(awaitingFetch)

    let index: BlogSearchEntry[]
    try {
      index = await loadIndex(indexUrl)
    } catch {
      // Fail closed: keep the static, JS-independent listing on screen, but
      // say why rather than passing it off as search results.
      if (myRequestId === requestId) view.showError()
      return
    }

    if (myRequestId !== requestId || getQuery().trim() !== trimmed) return

    view.showResults(
      index.filter((entry) =>
        matchesBlogSearch(entry, { q: trimmed, lang, category })
      )
    )
  }

  return {
    runSearch,
    scheduleSearch(query: string) {
      window.clearTimeout(debounceHandle)
      debounceHandle = window.setTimeout(() => {
        void runSearch(query)
        updateUrlQuery(query.trim())
      }, DEBOUNCE_MS)
    },
    cancelScheduled() {
      window.clearTimeout(debounceHandle)
    }
  }
}

export function initBlogSearch(): void {
  const dom = collectSearchDom()
  if (!dom) return

  const { root, input } = dom
  const indexUrl = root.dataset.searchIndexUrl
  if (!indexUrl) return

  const lang = (root.dataset.selectedContentLang ?? '') as Locale
  const view = createSearchView(dom, {
    // Server-rendered and never change; read once so each announcement and the
    // visible copy it mirrors can't drift apart.
    resultsTemplate: dom.searchCount?.dataset.resultsTemplate ?? '{count}',
    emptyMessage: dom.emptyState.textContent?.trim() ?? '',
    errorMessage: dom.searchError?.textContent?.trim() ?? '',
    searchingMessage: root.dataset.searchingLabel ?? '',
    initialStaticHidden: dom.staticList.hidden,
    initialEmptyHidden: dom.emptyState.hidden,
    lang,
    categoryLabels: JSON.parse(root.dataset.categoryLabels ?? '{}') as Record<
      string,
      string
    >
  })

  const controller = createSearchController({
    indexUrl,
    lang,
    // Raw category term, absent on /category/all and on term-fallback pages
    // (where the static list itself shows every post for the language).
    category: root.dataset.selectedCategory || undefined,
    view,
    getQuery: () => input.value
  })

  function syncFilterHrefs() {
    syncSearchHrefs(root, input.value, window.location.origin)
  }

  let lastTrackedQuery = ''
  function trackCommittedSearch() {
    const trimmed = input.value.trim()
    if (!trimmed || trimmed === lastTrackedQuery) return
    lastTrackedQuery = trimmed
    trackSearch(trimmed)
  }

  input.addEventListener('input', () => {
    controller.scheduleSearch(input.value)
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
      controller.cancelScheduled()
      view.showStatic()
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
    void controller.runSearch(initialQuery)
  }
  // After hydration, so a deep-linked `?q=` is already on the filter links
  // before the first click.
  syncFilterHrefs()
}
