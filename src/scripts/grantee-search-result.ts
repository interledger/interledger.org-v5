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

/**
 * Carry the live search onto a same-origin href. External destinations
 * (view-details) are left alone. Hash is preserved.
 */
export function hrefWithPreservedSearch(
  href: string,
  query: string,
  pageOrigin: string
): string {
  const trimmed = query.trim()
  if (!trimmed) return href
  const url = new URL(href, pageOrigin)
  if (url.origin !== new URL(pageOrigin).origin) return href
  url.searchParams.set(SEARCH_QUERY_PARAM, trimmed)
  return `${url.pathname}${url.search}${url.hash}`
}

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

function fillOrHide(
  wrap: HTMLElement,
  visible: boolean,
  fill: () => void
): void {
  if (visible) {
    fill()
    show(wrap)
  } else {
    hide(wrap)
  }
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
  const href = hrefWithPreservedSearch(
    getGranteeFilterUrl(
      context.directoryPath,
      context.selectedYear || undefined,
      tagSlug
    ),
    context.searchQuery,
    window.location.origin
  )

  pill.href = href
  pill.textContent = tag
  applyUmamiAttrs(
    pill,
    buildDeferredUmamiAttrs({
      pathname: context.pathname,
      lang: context.lang,
      label: 'button_ui',
      baseComponent: 'grantee_tag',
      linkText: `#${tag}`,
      href
    })
  )
  list.append(fragment)
}

function fillTags(
  row: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  entry: GranteeSearchEntry,
  context: SearchResultContext
): void {
  const tagsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-tags-wrap]'
  )
  fillOrHide(tagsWrap, entry.tags.length > 0, () => {
    entry.tags.forEach((tag) =>
      appendTagPill(tagsWrap, tagTemplate, tag, context)
    )
  })
}

function fillMeta(row: HTMLElement, entry: GranteeSearchEntry): void {
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

  fillOrHide(countryWrap, Boolean(entry.country), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-country]'),
      entry.country
    )
  })
  fillOrHide(dateWrap, Boolean(entry.startLabel), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-date-text]'),
      entry.startLabel
    )
    const timeEl = requireElement<HTMLTimeElement>(
      row,
      '[data-grantee-search-date]'
    )
    if (entry.startMonth) timeEl.dateTime = entry.startMonth
  })
  fillOrHide(metaWrap, Boolean(entry.country || entry.startLabel), () => {})
}

function fillDescription(row: HTMLElement, entry: GranteeSearchEntry): void {
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

  fillOrHide(leadersWrap, entry.leaders.length > 0, () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-leaders]'),
      entry.leaders.join(', ')
    )
    leadersWrap.classList.toggle('mb-lg', Boolean(entry.descriptionSnippet))
  })
  fillOrHide(snippet, Boolean(entry.descriptionSnippet), () => {
    setTextContent(snippet, entry.descriptionSnippet ?? '')
  })
  fillOrHide(
    descriptionPanel,
    entry.leaders.length > 0 || Boolean(entry.descriptionSnippet),
    () => {}
  )
}

function fillDetails(
  row: HTMLElement,
  entry: GranteeSearchEntry,
  context: SearchResultContext
): void {
  const detailsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-details-wrap]'
  )
  const detailsLink = requireElement<HTMLAnchorElement>(
    row,
    '[data-grantee-search-details-link]'
  )
  fillOrHide(detailsWrap, Boolean(entry.projectUrl), () => {
    const href = entry.projectUrl ?? ''
    detailsLink.href = href
    applyUmamiAttrs(
      detailsLink,
      buildUmamiAttrs({
        pathname: context.pathname,
        lang: context.lang,
        label: 'button_card',
        baseComponent: 'grantee_cards',
        href,
        linkText: context.viewDetailsLabel
      })
    )
  })
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
  fillOrHide(program, Boolean(entry.program), () => {
    setTextContent(program, entry.program)
  })

  const budgetWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-budget-wrap]'
  )
  fillOrHide(budgetWrap, Boolean(entry.budgetLabel), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-budget-amount]'),
      entry.budgetLabel ?? ''
    )
  })

  fillTags(row, tagTemplate, entry, context)
  fillMeta(row, entry)
  fillDescription(row, entry)
  fillDetails(row, entry, context)
  return row
}
