import { getVisiblePages } from '@/utils/shared/pagination'
import { escapeHtml } from '@/utils/main/umami'
import {
  GRANTEE_PAGE_SIZE,
  matchesGranteeFilters,
  parseGranteeRecords,
  type Grantee,
  type GranteeFilters
} from '@/utils/main/grantee'
import type { Locale } from '@/utils/main/locales'
import rawGranteeData from '@/data/airtable/grantee-data.json'

const PAGE_LINK_CLASSES = [
  'inline-block',
  'p-sm',
  'no-underline',
  'bg-transparent',
  'rounded-lg',
  'text-body-sm-standard',
  'text-neutral-75',
  'transition-all',
  'duration-200',
  'ease-in-out',
  'hover:bg-neutral-25',
  'hover:text-link',
  'focus-visible:bg-neutral-25',
  'focus-visible:text-link',
  'focus-visible:outline-none',
  "[&[aria-current='page']]:border",
  "[&[aria-current='page']]:border-link",
  "[&[aria-current='page']]:pointer-events-none",
  "[&[aria-current='page']]:text-link"
].join(' ')

const ICON = {
  pin: '<svg class="size-5 shrink-0 text-neutral-75" viewBox="0 0 19 25" fill="currentColor" aria-hidden="true"><path d="M10.985 11.012A2.15 2.15 0 0 0 11.616 9.488a2.15 2.15 0 0 0-2.155-2.155 2.15 2.15 0 0 0-2.154 2.155 2.15 2.15 0 0 0 2.154 2.524 2.15 2.15 0 0 0 2.524-1zm-1.524 11.224C11.968 20.055 13.95 17.836 15.405 15.581S17.59 11.375 17.59 9.728c0-2.439-.772-4.452-2.316-6.04C13.728 2.101 11.79 1.308 9.461 1.308S5.195 2.101 3.65 3.688C2.104 5.275 1.332 7.288 1.333 9.728c0 1.646.728 3.597 2.184 5.853s3.437 4.474 5.944 6.655zm0 1.79C6.328 21.255 3.968 18.671 2.381 16.273.794 13.876 0 11.694 0 9.728 0 6.908.918 4.581 2.755 2.749 4.592.916 6.828 0 9.461 0s4.87.916 6.707 2.749C18.004 4.581 18.923 6.908 18.923 9.728c0 1.966-.794 4.148-2.38 6.545-1.588 2.398-3.948 4.982-7.082 7.752z"/></svg>',
  calendar:
    '<svg class="size-5 shrink-0 text-neutral-75" viewBox="0 0 22 25" fill="currentColor" aria-hidden="true"><path d="M2.155 24.307C1.54 24.307 1.028 24.101.617 23.691.207 23.28.001 22.768 0 22.153V5.127C0 4.513.206 4.001.617 3.591 1.029 3.18 1.541 2.974 2.155 2.973H4.513V0h1.436v2.973h9.539V0h1.333v2.973H19.18c.613 0 1.126.206 1.537.618.412.411.617.924.616 1.537v17.025c0 .614-.205 1.126-.616 1.538-.411.411-.924.617-1.539.616H2.155zm0-1.334H19.18c.204 0 .392-.085.564-.256.172-.17.257-.359.256-.565V10.461H1.333v11.692c0 .205.086.393.256.564.171.172.359.257.564.256M1.333 9.127H20V5.127c0-.205-.085-.393-.256-.564-.171-.172-.359-.257-.565-.256H2.155c-.206 0-.394.085-.566.256-.171.17-.257.359-.256.565v4z"/></svg>',
  user: '<svg class="size-5 shrink-0 text-neutral-75" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5m0 2c-3.866 0-11 1.94-11 5.8V22h22v-2.2c0-3.86-7.134-5.8-11-5.8"/></svg>',
  external:
    '<svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M11 1.5H14.5V5M13.75 2.25L10 6M8.5 2.5H4A1.5 1.5 0 0 0 2.5 4v8A1.5 1.5 0 0 0 4 13.5h8A1.5 1.5 0 0 0 13.5 12V7.5"/></svg>'
}

interface Labels {
  currency: string
  amount: string
  details: string
  lead: string
  location: string
  date: string
  tags: string
  newTab: string
  buttonClass: string
}

function readFilters(form: HTMLFormElement): GranteeFilters {
  const data = new FormData(form)
  return {
    year: String(data.get('year') ?? ''),
    program: String(data.get('program') ?? ''),
    country: String(data.get('country') ?? '')
  }
}

function applyFiltersToForm(form: HTMLFormElement, filters: GranteeFilters) {
  const year = form.elements.namedItem('year')
  const program = form.elements.namedItem('program')
  const country = form.elements.namedItem('country')
  if (year instanceof HTMLSelectElement) year.value = filters.year
  if (program instanceof HTMLSelectElement) program.value = filters.program
  if (country instanceof HTMLSelectElement) country.value = filters.country
}

function filtersFromUrl(): { filters: GranteeFilters; page: number } {
  const params = new URLSearchParams(window.location.search)
  const pageRaw = Number(params.get('page') ?? '1')
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  return {
    filters: {
      year: params.get('year') ?? '',
      program: params.get('program') ?? '',
      country: params.get('country') ?? ''
    },
    page
  }
}

function writeUrl(filters: GranteeFilters, page: number) {
  const params = new URLSearchParams()
  if (filters.year) params.set('year', filters.year)
  if (filters.program) params.set('program', filters.program)
  if (filters.country) params.set('country', filters.country)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  const next = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname
  window.history.replaceState(null, '', next)
}

function filtersAreEmpty(filters: GranteeFilters): boolean {
  return !filters.year && !filters.program && !filters.country
}

function setDisabled(link: HTMLAnchorElement, disabled: boolean) {
  if (disabled) {
    link.setAttribute('aria-disabled', 'true')
    link.removeAttribute('href')
  } else {
    link.removeAttribute('aria-disabled')
    link.setAttribute('href', window.location.pathname)
  }
}

function renderPageNumbers(
  marker: HTMLElement,
  currentPage: number,
  lastPage: number,
  paginationLabel: string
) {
  const list = marker.parentElement
  if (!list) return

  list
    .querySelectorAll('[data-grantee-page-item]')
    .forEach((node) => node.remove())

  const pages = getVisiblePages(currentPage, lastPage)
  const nodes: HTMLElement[] = []

  for (const page of pages) {
    const li = document.createElement('li')
    li.setAttribute('data-grantee-page-item', '')
    if (page === '...') {
      const span = document.createElement('span')
      span.setAttribute('aria-hidden', 'true')
      span.className = 'inline-block m-sm w-[24px] h-[24px] text-center'
      span.textContent = '…'
      li.append(span)
    } else {
      const link = document.createElement('a')
      link.href = `${window.location.pathname}?page=${page}`
      link.className = PAGE_LINK_CLASSES
      link.dataset.granteePage = String(page)
      link.setAttribute('aria-label', `${paginationLabel} ${page}`)
      if (page === currentPage) link.setAttribute('aria-current', 'page')
      const label = document.createElement('span')
      label.textContent = String(page)
      link.append(label)
      li.append(link)
    }
    nodes.push(li)
  }

  marker.after(...nodes)
}

function pillList(tags: string[], label: string): string {
  if (tags.length === 0) return ''
  const items = tags
    .map(
      (tag) =>
        `<li class="m-0"><span class="inline-block px-sm py-xs text-body-sm-standard text-neutral-100 border border-neutral-50 rounded-full">${escapeHtml(tag)}</span></li>`
    )
    .join('')
  return `<ul class="flex flex-wrap gap-xs list-none m-0 p-0" aria-label="${escapeHtml(label)}">${items}</ul>`
}

function metaItem(icon: string, sr: string, value: string): string {
  return `<li class="flex items-center gap-sm text-body-sm-standard text-neutral-100 min-w-0 m-0">${icon}<span><span class="sr-only">${escapeHtml(sr)}: </span>${value}</span></li>`
}

function renderCard(grantee: Grantee, labels: Labels): string {
  const name = escapeHtml(grantee.name)
  const program = grantee.program
    ? `<p class="m-0 text-body-lg-standard text-neutral-75">${escapeHtml(grantee.program)}</p>`
    : ''
  const amount = grantee.budgetLabel
    ? `<div class="shrink-0 desktop:text-right"><p class="m-0 text-h3 text-neutral-150 tablet:text-h3-md desktop:text-h3-lg"><span>${escapeHtml(grantee.budgetLabel)}</span><span class="ms-xs align-super text-body-sm-standard text-neutral-75">${escapeHtml(labels.currency)}</span></p><p class="m-0 text-body-sm-standard text-neutral-75">${escapeHtml(labels.amount)}</p></div>`
    : ''
  const leaders = escapeHtml(grantee.leaders.join(', '))
  const meta = [
    grantee.country
      ? metaItem(ICON.pin, labels.location, escapeHtml(grantee.country))
      : '',
    grantee.startLabel
      ? `<li class="flex items-center gap-sm text-body-sm-standard text-neutral-100 min-w-0 m-0">${ICON.calendar}<time datetime="${escapeHtml(grantee.startMonth)}"><span class="sr-only">${escapeHtml(labels.date)}: </span>${escapeHtml(grantee.startLabel)}</time></li>`
      : '',
    leaders ? metaItem(ICON.user, labels.lead, leaders) : ''
  ].join('')
  const description = grantee.description
    ? `<p class="m-0 rounded-2xl bg-ice-indigo-50 p-lg text-body-lg-standard text-neutral-100">${escapeHtml(grantee.description.length > 280 ? `${grantee.description.slice(0, 280).replace(/\s+\S*$/, '')} …` : grantee.description)}</p>`
    : ''
  const cta = grantee.projectUrl
    ? `<div class="flex flex-wrap gap-md"><a href="${escapeHtml(grantee.projectUrl)}" class="${labels.buttonClass}" target="_blank" rel="noopener noreferrer" data-component="LinkButton">${escapeHtml(labels.details)}${ICON.external}<span class="sr-only">${escapeHtml(labels.newTab)}</span></a></div>`
    : ''

  return `<li class="m-0 rounded-3xl border border-neutral-50 bg-white p-xl">
  <article class="flex flex-col gap-lg">
    <div class="flex flex-col gap-lg desktop:flex-row desktop:items-start desktop:justify-between desktop:gap-3xl">
      <div class="flex min-w-0 flex-col gap-sm">
        <h3 class="m-0 text-h3 text-neutral-150 tablet:text-h3-md desktop:text-h3-lg">${name}</h3>
        ${program}
      </div>
      ${amount}
    </div>
    ${pillList(grantee.tags, labels.tags)}
    <ul class="flex flex-col gap-sm list-none m-0 p-0 tablet:flex-row tablet:flex-wrap tablet:gap-xl">${meta}</ul>
    ${description}
    ${cta}
  </article>
</li>`
}

function readPayload(): Grantee[] {
  const locale = (
    document.documentElement.lang === 'es' ? 'es' : 'en'
  ) as Locale
  const parsed = parseGranteeRecords(rawGranteeData, locale)
  return parsed instanceof Error ? [] : parsed
}

function initDirectory(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-grantee-filters]')
  const list = root.querySelector<HTMLElement>('[data-grantee-list]')
  const empty = root.querySelector<HTMLElement>('[data-grantee-empty]')
  const status = root.querySelector<HTMLElement>('[data-grantee-status]')
  const pagination = root.querySelector<HTMLElement>(
    '[data-grantee-pagination]'
  )
  const staticPagination = root.querySelector<HTMLElement>(
    '[data-static-pagination]'
  )
  const pageMarker = root.querySelector<HTMLElement>(
    '[data-grantee-page-numbers]'
  )
  const prevLink = root.querySelector<HTMLAnchorElement>(
    '[data-grantee-page="prev"]'
  )
  const nextLink = root.querySelector<HTMLAnchorElement>(
    '[data-grantee-page="next"]'
  )
  const allGrantees = readPayload()
  if (
    !form ||
    !list ||
    !empty ||
    !status ||
    !pagination ||
    !pageMarker ||
    allGrantees.length === 0
  ) {
    return
  }

  const resultsTemplate = root.dataset.resultsTemplate ?? '{count} results'
  const paginationLabel = root.dataset.paginationLabel ?? ''
  const labels: Labels = {
    currency: root.dataset.labelCurrency ?? 'USD',
    amount: root.dataset.labelAmount ?? '',
    details: root.dataset.labelDetails ?? '',
    lead: root.dataset.labelLead ?? '',
    location: root.dataset.labelLocation ?? '',
    date: root.dataset.labelDate ?? '',
    tags: root.dataset.labelTags ?? '',
    newTab: root.dataset.labelNewTab ?? '',
    buttonClass: root.dataset.buttonClass ?? ''
  }

  let currentPage = 1

  function apply(filters: GranteeFilters, page: number, scrollToList: boolean) {
    const matches = allGrantees.filter((grantee) =>
      matchesGranteeFilters(grantee, filters)
    )
    const lastPage = Math.max(1, Math.ceil(matches.length / GRANTEE_PAGE_SIZE))
    currentPage = Math.min(Math.max(page, 1), lastPage)
    const start = (currentPage - 1) * GRANTEE_PAGE_SIZE
    const visible = matches.slice(start, start + GRANTEE_PAGE_SIZE)

    list.innerHTML = visible
      .map((grantee) => renderCard(grantee, labels))
      .join('')
    empty.classList.toggle('hidden', matches.length > 0)
    list.classList.toggle('hidden', matches.length === 0)
    status.textContent = resultsTemplate.replace(
      '{count}',
      String(matches.length)
    )

    const showPagination = matches.length > GRANTEE_PAGE_SIZE
    pagination.classList.toggle('hidden', !showPagination)
    staticPagination?.classList.add('hidden')
    if (showPagination) {
      renderPageNumbers(pageMarker, currentPage, lastPage, paginationLabel)
      if (prevLink) setDisabled(prevLink, currentPage <= 1)
      if (nextLink) setDisabled(nextLink, currentPage >= lastPage)
    }

    if (filtersAreEmpty(filters) && currentPage === 1) {
      writeUrl(filters, 1)
    } else {
      writeUrl(filters, currentPage)
    }

    if (scrollToList) {
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
      list.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      })
    }
  }

  const initial = filtersFromUrl()
  const staticPage = Number(root.dataset.staticPage ?? '1')
  const startPage =
    filtersAreEmpty(initial.filters) && initial.page === 1 && staticPage > 1
      ? staticPage
      : initial.page
  applyFiltersToForm(form, initial.filters)
  apply(initial.filters, startPage, false)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    apply(readFilters(form), 1, true)
  })

  form.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLSelectElement)) return
    apply(readFilters(form), 1, true)
  })

  pagination.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest<HTMLAnchorElement>('[data-grantee-page]')
    if (!link || link.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()

    const action = link.dataset.granteePage
    let nextPage = currentPage
    if (action === 'prev') nextPage = currentPage - 1
    else if (action === 'next') nextPage = currentPage + 1
    else {
      const parsed = Number(action)
      if (Number.isFinite(parsed)) nextPage = parsed
    }
    apply(readFilters(form), nextPage, true)
  })
}

const root = document.querySelector<HTMLElement>('[data-grantee-directory]')
if (root) initDirectory(root)
