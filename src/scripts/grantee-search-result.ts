import type { GranteeSearchEntry } from '@/utils/main/grantee'

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

function appendTagPill(
  list: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  tag: string
): void {
  const fragment = tagTemplate.content.cloneNode(true) as DocumentFragment
  const pill = fragment.querySelector('span')
  if (!pill) return
  pill.textContent = tag
  list.append(fragment)
}

/**
 * Clone `#grantee-search-result-template` and fill slots from a catalog entry.
 * Markup lives in GranteeSearchResultTemplate.astro — not built here.
 */
export function createSearchResultRow(
  entry: GranteeSearchEntry,
  rowTemplate: HTMLTemplateElement,
  tagTemplate: HTMLTemplateElement
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
    entry.tags.forEach((tag) => appendTagPill(tagsWrap, tagTemplate, tag))
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
    show(detailsWrap)
  } else {
    hide(detailsWrap)
  }

  return row
}
