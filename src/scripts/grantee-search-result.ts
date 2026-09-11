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
 *
 * Empty query returns `href` unchanged — including a leftover `?q=`. Callers
 * that need to strip search must pass the pre-search href (see
 * {@link hrefFromOriginal}).
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

/**
 * Derive a filter href from a stable original. Empty query restores
 * `originalHref`; a non-empty query always starts from that original so a
 * previous `?q=` cannot stick after a modified-click.
 */
export function hrefFromOriginal(
  originalHref: string,
  query: string,
  pageOrigin: string
): string {
  const trimmed = query.trim()
  if (!trimmed) return originalHref
  return hrefWithPreservedSearch(originalHref, trimmed, pageOrigin)
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

export interface SearchResultTagModel {
  text: string
  href: string
  umami: UmamiTrackAttrs
}

export interface SearchResultDetailsModel {
  href: string
  umami: UmamiAttrs
}

/**
 * Values `createSearchResultRow` writes into the Astro template.
 * A missing optional section is `null` or `[]`, not a DOM visibility flag.
 */
export interface SearchResultRowModel {
  name: string
  program: string | null
  budgetLabel: string | null
  tags: SearchResultTagModel[]
  country: string | null
  startLabel: string | null
  startMonth: string | null
  leaders: string | null
  leadersHasSnippetSpacer: boolean
  descriptionSnippet: string | null
  details: SearchResultDetailsModel | null
}

function tagPillModel(
  tag: string,
  context: SearchResultContext,
  pageOrigin: string
): SearchResultTagModel {
  const href = hrefWithPreservedSearch(
    getGranteeFilterUrl(
      context.directoryPath,
      context.selectedYear || undefined,
      generateSlug(tag)
    ),
    context.searchQuery,
    pageOrigin
  )
  return {
    text: tag,
    href,
    umami: buildDeferredUmamiAttrs({
      pathname: context.pathname,
      lang: context.lang,
      label: 'button_ui',
      baseComponent: 'grantee_tag',
      linkText: `#${tag}`,
      href
    })
  }
}

/** Pure row payload. `createSearchResultRow` is the template applicator. */
export function searchResultRowModel(
  entry: GranteeSearchEntry,
  context: SearchResultContext,
  pageOrigin: string
): SearchResultRowModel {
  const leaders = entry.leaders.length > 0 ? entry.leaders.join(', ') : null
  const descriptionSnippet = entry.descriptionSnippet || null
  const detailsHref = entry.projectUrl || null

  return {
    name: entry.name,
    program: entry.program || null,
    budgetLabel: entry.budgetLabel || null,
    tags: entry.tags.map((tag) => tagPillModel(tag, context, pageOrigin)),
    country: entry.country || null,
    startLabel: entry.startLabel || null,
    startMonth: entry.startMonth || null,
    leaders,
    leadersHasSnippetSpacer: Boolean(leaders && descriptionSnippet),
    descriptionSnippet,
    details: detailsHref
      ? {
          href: detailsHref,
          umami: buildUmamiAttrs({
            pathname: context.pathname,
            lang: context.lang,
            label: 'button_card',
            baseComponent: 'grantee_cards',
            href: detailsHref,
            linkText: context.viewDetailsLabel
          })
        }
      : null
  }
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
  fill?: () => void
): void {
  if (visible) {
    fill?.()
    show(wrap)
  } else {
    hide(wrap)
  }
}

function appendTagPill(
  list: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  tag: SearchResultTagModel
): void {
  const fragment = tagTemplate.content.cloneNode(true) as DocumentFragment
  const pill = fragment.querySelector('a')
  if (!pill) return

  pill.href = tag.href
  pill.textContent = tag.text
  applyUmamiAttrs(pill, tag.umami)
  list.append(fragment)
}

function fillTags(
  row: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  tags: SearchResultTagModel[]
): void {
  const tagsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-tags-wrap]'
  )
  fillOrHide(tagsWrap, tags.length > 0, () => {
    tags.forEach((tag) => appendTagPill(tagsWrap, tagTemplate, tag))
  })
}

function fillMeta(row: HTMLElement, model: SearchResultRowModel): void {
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

  fillOrHide(countryWrap, Boolean(model.country), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-country]'),
      model.country ?? ''
    )
  })
  fillOrHide(dateWrap, Boolean(model.startLabel), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-date-text]'),
      model.startLabel ?? ''
    )
    const timeEl = requireElement<HTMLTimeElement>(
      row,
      '[data-grantee-search-date]'
    )
    if (model.startMonth) timeEl.dateTime = model.startMonth
  })
  fillOrHide(metaWrap, Boolean(model.country || model.startLabel))
}

function fillDescription(row: HTMLElement, model: SearchResultRowModel): void {
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

  fillOrHide(leadersWrap, Boolean(model.leaders), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-leaders]'),
      model.leaders ?? ''
    )
    leadersWrap.classList.toggle('mb-lg', model.leadersHasSnippetSpacer)
  })
  fillOrHide(snippet, Boolean(model.descriptionSnippet), () => {
    setTextContent(snippet, model.descriptionSnippet ?? '')
  })
  fillOrHide(
    descriptionPanel,
    Boolean(model.leaders || model.descriptionSnippet)
  )
}

function fillDetails(row: HTMLElement, model: SearchResultRowModel): void {
  const detailsWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-details-wrap]'
  )
  const detailsLink = requireElement<HTMLAnchorElement>(
    row,
    '[data-grantee-search-details-link]'
  )
  fillOrHide(detailsWrap, Boolean(model.details), () => {
    const details = model.details
    if (!details) return
    detailsLink.href = details.href
    applyUmamiAttrs(detailsLink, details.umami)
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
  const model = searchResultRowModel(entry, context, window.location.origin)
  const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment
  const row = requireElement<HTMLLIElement>(fragment, 'li')

  setTextContent(requireElement(row, '[data-grantee-search-name]'), model.name)

  const program = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-program]'
  )
  fillOrHide(program, Boolean(model.program), () => {
    setTextContent(program, model.program ?? '')
  })

  const budgetWrap = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-budget-wrap]'
  )
  fillOrHide(budgetWrap, Boolean(model.budgetLabel), () => {
    setTextContent(
      requireElement(row, '[data-grantee-search-budget-amount]'),
      model.budgetLabel ?? ''
    )
  })

  fillTags(row, tagTemplate, model.tags)
  fillMeta(row, model)
  fillDescription(row, model)
  fillDetails(row, model)
  return row
}
