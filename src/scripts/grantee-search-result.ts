import type { GranteeSearchEntry } from '@/utils/main/grantee'
import { getGranteeFilterUrl } from '@/utils/main/granteeFilters'
import { generateSlug } from '@/utils/main/slug'
import {
  buildDeferredUmamiAttrs,
  buildUmamiAttrs,
  type UmamiAttrs,
  type UmamiTrackAttrs
} from '@/utils/main/umami'

const SEARCH_QUERY_PARAM = 'q'

/** Context the populate script needs but the JSON catalog does not carry. */
export interface SearchResultContext {
  directoryPath: string
  selectedYear: string
  searchQuery: string
  pathname: string
  lang: string
  viewDetailsLabel: string
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string
): T {
  const el = root.querySelector(selector)
  if (!el) {
    throw new Error(`Grantee search template missing ${selector}`)
  }
  return el as T
}

function setTextContent(el: Element | null, text: string): void {
  if (el) el.textContent = text
}

function show(el: HTMLElement | null): void {
  if (el) el.hidden = false
}

function hide(el: HTMLElement | null): void {
  if (el) el.hidden = true
}

function applyUmamiAttrs(
  el: HTMLElement,
  attrs: UmamiAttrs | UmamiTrackAttrs
): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value) el.setAttribute(key, value)
  }
}

/** Preserve an active directory search when navigating via a result pill. */
export function withSearchQuery(href: string, query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return href
  const url = new URL(href, window.location.origin)
  url.searchParams.set(SEARCH_QUERY_PARAM, trimmed)
  return `${url.pathname}${url.search}`
}

function appendTagPill(
  list: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  tag: string,
  context: SearchResultContext
): void {
  const fragment = tagTemplate.content.cloneNode(true) as DocumentFragment
  const pill = fragment.querySelector('a')
  if (!pill) return

  const tagSlug = generateSlug(tag)
  const href = withSearchQuery(
    getGranteeFilterUrl(
      context.directoryPath,
      context.selectedYear || undefined,
      tagSlug
    ),
    context.searchQuery
  )

  pill.href = href
  pill.textContent = tag
  applyUmamiAttrs(
    pill,
    buildDeferredUmamiAttrs({
      pathname: context.pathname,
      lang: context.lang,
      section: 'cta',
      linkText: `#${tag}`,
      action: 'grantee_tag'
    })
  )
  list.append(fragment)
}

/**
 * Clone `#grantee-search-result-template` and fill slots from a catalog entry.
 * Markup lives in GranteeSearchResultTemplate.astro — not built here.
 */
export function createSearchResultRow(
  entry: GranteeSearchEntry,
  rowTemplate: HTMLTemplateElement,
  tagTemplate: HTMLTemplateElement,
  context: SearchResultContext
): HTMLLIElement {
  const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment
  const row = requireElement<HTMLLIElement>(fragment, 'li')

  setTextContent(requireElement(row, '[data-grantee-search-name]'), entry.name)

  const program = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-program]'
  )
  if (entry.program) {
    setTextContent(program, entry.program)
    show(program)
  } else {
    hide(program)
  }

  const budgetWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-budget-wrap]'
  )
  if (entry.budgetLabel) {
    setTextContent(
      requireElement(row, '[data-grantee-search-budget-amount]'),
      entry.budgetLabel
    )
    show(budgetWrap)
  } else {
    hide(budgetWrap)
  }

  const tagsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-tags-wrap]'
  )
  if (entry.tags.length > 0) {
    entry.tags.forEach((tag) =>
      appendTagPill(tagsWrap, tagTemplate, tag, context)
    )
    show(tagsWrap)
  } else {
    hide(tagsWrap)
  }

  const metaWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-meta-wrap]'
  )
  const countryWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-country-wrap]'
  )
  const dateWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-date-wrap]'
  )
  let hasMeta = false

  if (entry.country) {
    setTextContent(
      requireElement(row, '[data-grantee-search-country]'),
      entry.country
    )
    show(countryWrap)
    hasMeta = true
  } else {
    hide(countryWrap)
  }

  if (entry.startLabel) {
    setTextContent(
      requireElement(row, '[data-grantee-search-date-text]'),
      entry.startLabel
    )
    const timeEl = requireElement<HTMLTimeElement>(
      row,
      '[data-grantee-search-date]'
    )
    if (entry.startMonth) timeEl.dateTime = entry.startMonth
    show(dateWrap)
    hasMeta = true
  } else {
    hide(dateWrap)
  }

  if (hasMeta) {
    show(metaWrap)
  } else {
    hide(metaWrap)
  }

  const descriptionPanel = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-description-panel]'
  )
  const leadersWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-leaders-wrap]'
  )
  const snippet = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-snippet]'
  )
  let hasDescriptionPanel = false

  if (entry.leaders.length > 0) {
    setTextContent(
      requireElement(row, '[data-grantee-search-leaders]'),
      entry.leaders.join(', ')
    )
    leadersWrap.classList.toggle('mb-lg', Boolean(entry.descriptionSnippet))
    show(leadersWrap)
    hasDescriptionPanel = true
  } else {
    hide(leadersWrap)
  }

  if (entry.descriptionSnippet) {
    setTextContent(snippet, entry.descriptionSnippet)
    show(snippet)
    hasDescriptionPanel = true
  } else {
    hide(snippet)
  }

  if (hasDescriptionPanel) {
    show(descriptionPanel)
  } else {
    hide(descriptionPanel)
  }

  const detailsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-details-wrap]'
  )
  const detailsLink = requireElement<HTMLAnchorElement>(
    row,
    '[data-grantee-search-details-link]'
  )
  if (entry.projectUrl) {
    detailsLink.href = entry.projectUrl
    applyUmamiAttrs(
      detailsLink,
      buildUmamiAttrs({
        pathname: context.pathname,
        lang: context.lang,
        section: 'card',
        href: entry.projectUrl,
        linkText: context.viewDetailsLabel,
        action: 'grantee_details'
      })
    )
    show(detailsWrap)
  } else {
    hide(detailsWrap)
  }

  return row
}
