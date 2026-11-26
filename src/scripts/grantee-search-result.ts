import type {
  GranteeReportLink,
  GranteeSearchEntry,
  GranteeSearchProject
} from '@/utils/main/granteeDirectory'
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
 * Carry the live search onto a same-origin href. External destinations are
 * left alone. Hash is preserved.
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
  /** "{count} grants"; `grantCountOneLabel` is the singular. */
  grantCountTemplate: string
  grantCountOneLabel: string
}

export interface SearchResultTagModel {
  text: string
  href: string
  umami: UmamiTrackAttrs
}

export interface SearchResultReportModel {
  label: string
  href: string
  external?: boolean
  umami: UmamiAttrs
}

export interface SearchResultProjectModel {
  name: string
  program: string | null
  budgetLabel: string | null
  reports: SearchResultReportModel[]
}

/**
 * Values `createSearchResultRow` writes into the Astro template.
 * A missing optional section is `null` or `[]`, not a DOM visibility flag.
 */
export interface SearchResultRowModel {
  name: string
  tags: SearchResultTagModel[]
  country: string | null
  startLabel: string | null
  startMonth: string | null
  grantCount: string
  projects: SearchResultProjectModel[]
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

function reportModel(
  report: GranteeReportLink,
  context: SearchResultContext
): SearchResultReportModel {
  return {
    label: report.label,
    href: report.href,
    external: report.external,
    umami: buildUmamiAttrs({
      pathname: context.pathname,
      lang: context.lang,
      label: 'button_card',
      baseComponent: 'grantee_cards',
      linkText: report.label,
      href: report.href
    })
  }
}

function projectModel(
  project: GranteeSearchProject,
  context: SearchResultContext
): SearchResultProjectModel {
  return {
    name: project.name,
    program: project.program || null,
    budgetLabel: project.budgetLabel || null,
    reports: project.reports.map((report) => reportModel(report, context))
  }
}

/** "1 grant" or "3 grants", from the labels the page passes in. */
export function formatGrantCount(
  count: number,
  context: Pick<
    SearchResultContext,
    'grantCountTemplate' | 'grantCountOneLabel'
  >
): string {
  if (count === 1) return context.grantCountOneLabel
  return context.grantCountTemplate.replaceAll('{count}', String(count))
}

/** Pure row payload. `createSearchResultRow` is the template applicator. */
export function searchResultRowModel(
  entry: GranteeSearchEntry,
  context: SearchResultContext,
  pageOrigin: string
): SearchResultRowModel {
  return {
    name: entry.name,
    tags: entry.tags.map((tag) => tagPillModel(tag, context, pageOrigin)),
    country: entry.country || null,
    startLabel: entry.startLabel || null,
    startMonth: entry.startMonth || null,
    grantCount: formatGrantCount(entry.projects.length, context),
    projects: entry.projects.map((project) => projectModel(project, context))
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

function setTextContent(el: Element, text: string): void {
  el.textContent = text
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
  if (visible) fill?.()
  wrap.hidden = !visible
}

function cloneTemplate(template: HTMLTemplateElement): DocumentFragment {
  return template.content.cloneNode(true) as DocumentFragment
}

/** The `<template>`s a result is built from, all in GranteeSearchResultTemplate.astro. */
export interface SearchResultTemplates {
  row: HTMLTemplateElement
  tag: HTMLTemplateElement
  project: HTMLTemplateElement
  report: HTMLTemplateElement
}

function appendTagPill(
  list: HTMLElement,
  tagTemplate: HTMLTemplateElement,
  tag: SearchResultTagModel
): void {
  const fragment = cloneTemplate(tagTemplate)
  const pill = requireElement<HTMLAnchorElement>(fragment, 'a')
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

function appendReportLink(
  list: HTMLElement,
  reportTemplate: HTMLTemplateElement,
  report: SearchResultReportModel,
  projectName: string
): void {
  const fragment = cloneTemplate(reportTemplate)
  const link = requireElement<HTMLAnchorElement>(fragment, 'a')
  link.href = report.href
  requireElement<HTMLElement>(
    link,
    '[data-grantee-search-report-external]'
  ).hidden = !report.external
  if (report.external) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    requireElement<HTMLElement>(
      link,
      '[data-grantee-search-report-new-tab]'
    ).hidden = false
  }
  applyUmamiAttrs(link, report.umami)
  setTextContent(
    requireElement(link, '[data-grantee-search-report-label]'),
    report.label
  )
  setTextContent(
    requireElement(link, '[data-grantee-search-report-project]'),
    `, ${projectName}`
  )
  list.append(fragment)
}

function fillReports(
  item: HTMLElement,
  reportTemplate: HTMLTemplateElement,
  project: SearchResultProjectModel
): void {
  const noReports = requireElement<HTMLElement>(
    item,
    '[data-grantee-search-no-reports]'
  )
  const reportList = requireElement<HTMLElement>(
    item,
    '[data-grantee-search-reports]'
  )
  const { reports } = project
  noReports.hidden = reports.length > 0
  fillOrHide(reportList, reports.length > 0, () => {
    reports.forEach((report) =>
      appendReportLink(reportList, reportTemplate, report, project.name)
    )
  })
}

function appendProject(
  list: HTMLElement,
  templates: SearchResultTemplates,
  project: SearchResultProjectModel
): void {
  const fragment = cloneTemplate(templates.project)
  const item = requireElement<HTMLLIElement>(fragment, 'li')

  setTextContent(
    requireElement(item, '[data-grantee-search-project-name]'),
    project.name
  )
  const program = requireElement<HTMLElement>(
    item,
    '[data-grantee-search-program]'
  )
  fillOrHide(program, Boolean(project.program), () => {
    setTextContent(program, project.program ?? '')
  })
  const budget = requireElement<HTMLElement>(
    item,
    '[data-grantee-search-budget]'
  )
  fillOrHide(budget, Boolean(project.budgetLabel), () => {
    // "{amount} USD committed", translated by the template.
    const template = budget.dataset.template ?? '{amount}'
    setTextContent(
      budget,
      template.replaceAll('{amount}', project.budgetLabel ?? '')
    )
  })
  fillReports(item, templates.report, project)
  list.append(fragment)
}

/**
 * Clone `#grantee-search-result-template` and fill slots from a catalog entry.
 * Markup lives in GranteeSearchResultTemplate.astro — not built here.
 */
export function createSearchResultRow(
  entry: GranteeSearchEntry,
  templates: SearchResultTemplates,
  context: SearchResultContext
): HTMLLIElement {
  const model = searchResultRowModel(entry, context, window.location.origin)
  const fragment = cloneTemplate(templates.row)
  const row = requireElement<HTMLLIElement>(fragment, 'li')

  setTextContent(requireElement(row, '[data-grantee-search-name]'), model.name)
  fillMeta(row, model)
  fillTags(row, templates.tag, model.tags)
  setTextContent(
    requireElement(row, '[data-grantee-search-grant-count]'),
    model.grantCount
  )
  const projects = requireElement<HTMLElement>(
    row,
    '[data-grantee-search-projects]'
  )
  model.projects.forEach((project) =>
    appendProject(projects, templates, project)
  )
  return row
}
