import {
  matchesGranteeFilters,
  type GranteeSearchEntry
} from '@/utils/main/grantee'

// Imported directly from grantee.ts (not the `@/utils` barrel): the barrel
// also re-exports modules that touch `astro:content`, which isn't available
// in a plain client bundle. grantee.ts itself has no such dependency.

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

// Fixed, hardcoded SVG bodies (not derived from entry data) — same trust
// model as Icon.astro's own `set:html`. Paths copied from its `map-pin`/
// `calendar`/`user` entries so search rows use the same iconography as a
// static GranteeCard instead of icon-less plain text.
const MAP_PIN_ICON = {
  viewBox: '0 0 19 25',
  path: 'M10.9853 11.012C11.4058 10.5924 11.616 10.0844 11.616 9.488C11.616 8.89067 11.4058 8.38222 10.9853 7.96267C10.5658 7.54311 10.0578 7.33333 9.46133 7.33333C8.86489 7.33333 8.35689 7.54311 7.93733 7.96267C7.51778 8.38222 7.308 8.89067 7.308 9.488C7.308 10.0836 7.51778 10.5916 7.93733 11.012C8.35689 11.4316 8.86489 11.6413 9.46133 11.6413C10.0578 11.6413 10.5658 11.4316 10.9853 11.012ZM9.46133 22.236C11.968 20.0547 13.9493 17.8364 15.4053 15.5813C16.8613 13.3262 17.5893 11.3751 17.5893 9.728C17.5893 7.28889 16.8173 5.27555 15.2733 3.688C13.7276 2.10133 11.7902 1.308 9.46133 1.308C7.13244 1.308 5.19511 2.10133 3.64933 3.688C2.10356 5.27467 1.33156 7.288 1.33333 9.728C1.33333 11.3742 2.06133 13.3253 3.51733 15.5813C4.97333 17.8373 6.95467 20.0556 9.46133 22.236ZM9.46133 24.0253C6.328 21.2547 3.968 18.6707 2.38133 16.2733C0.793778 13.876 0 11.6942 0 9.728C0 6.90755 0.918222 4.58133 2.75467 2.74933C4.592 0.916444 6.82756 0 9.46133 0C12.0951 0 14.3307 0.916444 16.168 2.74933C18.0044 4.58133 18.9227 6.90755 18.9227 9.728C18.9227 11.6942 18.1293 13.876 16.5427 16.2733C14.9551 18.6707 12.5947 21.2547 9.46133 24.0253Z'
} as const
const CALENDAR_ICON = {
  viewBox: '0 0 22 25',
  path: 'M2.15467 24.3067C1.54044 24.3067 1.028 24.1013 0.617333 23.6907C0.206666 23.28 0.000888889 22.7676 0 22.1533V5.12667C0 4.51333 0.205778 4.00133 0.617333 3.59067C1.02889 3.18 1.54133 2.97422 2.15467 2.97333H4.51333V0H5.94933V2.97333H15.488V0H16.8213V2.97333H19.18C19.7933 2.97333 20.3058 3.17911 20.7173 3.59067C21.1289 4.00222 21.3342 4.51467 21.3333 5.128V22.1533C21.3333 22.7667 21.128 23.2791 20.7173 23.6907C20.3067 24.1022 19.7938 24.3076 19.1787 24.3067H2.15467ZM2.15467 22.9733H19.18C19.3844 22.9733 19.5724 22.888 19.744 22.7173C19.9156 22.5467 20.0009 22.3582 20 22.152V10.4613H1.33333V22.1533C1.33333 22.3578 1.41867 22.5458 1.58933 22.7173C1.76 22.8889 1.948 22.9742 2.15333 22.9733M1.33333 9.12667H20V5.12667C20 4.92222 19.9147 4.73422 19.744 4.56267C19.5733 4.39111 19.3849 4.30578 19.1787 4.30667H2.15467C1.94933 4.30667 1.76089 4.392 1.58933 4.56267C1.41778 4.73333 1.33244 4.92178 1.33333 5.128V9.12667Z'
} as const
const USER_ICON = {
  viewBox: '0 0 24 24',
  path: 'M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5s-5 2.239-5 5s2.239 5 5 5m0 2c-3.866 0-11 1.94-11 5.8V22h22v-2.2c0-3.86-7.134-5.8-11-5.8'
} as const

function createMetaIcon(icon: {
  viewBox: string
  path: string
}): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', icon.viewBox)
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'size-5 shrink-0 text-neutral-75')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', icon.path)
  svg.append(path)
  return svg
}

const META_ITEM_CLASSES =
  'flex items-center gap-sm text-body-sm-standard text-neutral-100'

function fillMetaRow(
  row: HTMLElement,
  icon: { viewBox: string; path: string },
  label: string,
  text: string
): void {
  const span = document.createElement('span')
  if (label) {
    const srLabel = document.createElement('span')
    srLabel.className = 'sr-only'
    srLabel.textContent = `${label}: `
    span.append(srLabel)
  }
  span.append(document.createTextNode(text))
  row.append(createMetaIcon(icon), span)
}

function createMetaItem(
  icon: { viewBox: string; path: string },
  label: string,
  text: string
): HTMLLIElement {
  const item = document.createElement('li')
  item.className = `m-0 ${META_ITEM_CLASSES}`
  fillMetaRow(item, icon, label, text)
  return item
}

function createMetaBlock(
  icon: { viewBox: string; path: string },
  label: string,
  text: string
): HTMLDivElement {
  const block = document.createElement('div')
  block.className = META_ITEM_CLASSES
  fillMetaRow(block, icon, label, text)
  return block
}

function createTagPill(tag: string): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'm-0'
  const pill = document.createElement('span')
  pill.className =
    'inline-block px-sm py-xs text-body-sm-standard text-neutral-100 border border-neutral-50 rounded-full bg-transparent'
  pill.textContent = tag
  item.append(pill)
  return item
}

interface ResultRowLabels {
  viewDetails: string
  opensNewTab: string
  projectLead: string
  location: string
  date: string
  currency: string
  amount: string
}

function createResultRow(
  entry: GranteeSearchEntry,
  labels: ResultRowLabels
): HTMLLIElement {
  const item = document.createElement('li')
  item.className =
    'm-0 flex flex-col gap-lg rounded-3xl border border-neutral-50 bg-white p-lg tablet:p-xl'

  const header = document.createElement('div')
  header.className =
    'flex flex-col gap-lg desktop:flex-row desktop:items-start desktop:justify-between desktop:gap-3xl'

  const titles = document.createElement('div')
  titles.className = 'flex min-w-0 flex-col gap-sm'
  const name = document.createElement('h3')
  name.className =
    'm-0 text-h3 text-neutral-150 tablet:text-h3-md desktop:text-h3-lg'
  name.textContent = entry.name
  titles.append(name)
  if (entry.program) {
    const program = document.createElement('p')
    program.className =
      'm-0 text-h5 tablet:text-h5-md desktop:text-h5-lg text-neutral-75'
    program.textContent = entry.program
    titles.append(program)
  }
  header.append(titles)

  if (entry.budgetLabel) {
    const budgetWrap = document.createElement('div')
    budgetWrap.className = 'shrink-0 desktop:text-right'

    const amountLine = document.createElement('p')
    amountLine.className =
      'm-0 flex items-start gap-sm font-poppins font-semibold text-h2 text-neutral-150 tablet:text-h2-md desktop:justify-end desktop:text-h2-lg'
    const amount = document.createElement('span')
    amount.textContent = entry.budgetLabel
    const currency = document.createElement('span')
    currency.className =
      'self-end mb-sm whitespace-nowrap text-h3 font-normal tablet:text-h3-md desktop:text-h3-lg'
    currency.textContent = labels.currency
    amountLine.append(amount, currency)

    const amountCaption = document.createElement('p')
    amountCaption.className = 'm-0 text-body-sm-standard text-neutral-75'
    amountCaption.textContent = labels.amount

    budgetWrap.append(amountLine, amountCaption)
    header.append(budgetWrap)
  }

  item.append(header)

  if (entry.tags.length > 0) {
    const tagsList = document.createElement('ul')
    tagsList.className = 'flex flex-wrap gap-xs list-none m-0 p-0'
    tagsList.append(...entry.tags.map(createTagPill))
    item.append(tagsList)
  }

  if (entry.country || entry.startLabel) {
    const metaList = document.createElement('ul')
    metaList.className = 'flex flex-col gap-sm list-none m-0 p-0'
    if (entry.country) {
      metaList.append(
        createMetaItem(MAP_PIN_ICON, labels.location, entry.country)
      )
    }
    if (entry.startLabel) {
      metaList.append(
        createMetaItem(CALENDAR_ICON, labels.date, entry.startLabel)
      )
    }
    item.append(metaList)
  }

  if (entry.leaders.length > 0 || entry.descriptionSnippet) {
    const box = document.createElement('div')
    box.className = 'flex flex-col rounded-2xl bg-ice-indigo-50 p-lg'

    if (entry.leaders.length > 0) {
      const leaders = createMetaBlock(
        USER_ICON,
        labels.projectLead,
        entry.leaders.join(', ')
      )
      if (entry.descriptionSnippet) leaders.classList.add('mb-lg')
      box.append(leaders)
    }

    if (entry.descriptionSnippet) {
      const description = document.createElement('p')
      description.className = 'm-0 text-body-lg-standard text-neutral-100'
      description.textContent = entry.descriptionSnippet
      box.append(description)
    }

    item.append(box)
  }

  if (entry.projectUrl && labels.viewDetails) {
    const link = document.createElement('a')
    link.href = entry.projectUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.className =
      'self-start text-body-sm-standard text-link underline underline-offset-2 hover:text-link-hover'
    link.append(document.createTextNode(labels.viewDetails))
    if (labels.opensNewTab) {
      const srOnly = document.createElement('span')
      srOnly.className = 'sr-only'
      srOnly.textContent = labels.opensNewTab
      link.append(srOnly)
    }
    item.append(link)
  }

  return item
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

  if (
    !root ||
    !(input instanceof HTMLInputElement) ||
    !staticList ||
    !searchResults ||
    !emptyState ||
    !resultsCount
  ) {
    return
  }

  const indexUrl = root.dataset.searchIndexUrl
  if (!indexUrl) return

  const year = root.dataset.selectedYear ?? ''
  const tag = root.dataset.selectedTag ?? ''
  const resultsTemplate = root.dataset.resultsTemplate ?? '{count}'
  const labels: ResultRowLabels = {
    viewDetails: root.dataset.labelViewDetails ?? '',
    opensNewTab: root.dataset.labelOpensNewTab ?? '',
    projectLead: root.dataset.labelProjectLead ?? '',
    location: root.dataset.labelLocation ?? '',
    date: root.dataset.labelDate ?? '',
    currency: root.dataset.labelCurrency ?? '',
    amount: root.dataset.labelAmount ?? ''
  }

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
      ...entries.map((entry) => createResultRow(entry, labels))
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

    // A newer search superseded this one while the index was in flight.
    // Also bail if the field was cleared (Escape / empty input) without
    // bumping requestId — otherwise the old query paints over showStatic().
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

  // Year/tag filters navigate to a different static page — carry the current
  // search term along as `?q=` so switching filters doesn't lose it.
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
