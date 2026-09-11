import type { BlogSearchEntry } from '@/utils/main/blogSearch'
import type { Locale } from '@/utils/main/locales'
import { buildUmamiAttrs, type UmamiAttrs } from '@/utils/main/umami'

// Not @/utils/main/time's formatDate: it pulls in defaultLocale from
// main/locales.ts, which imports `z` from `astro:content` at module scope —
// a server-only import that can't be tree-shaken out of the client bundle
// even when only the (type-erased) Locale is used. This mirrors its output
// with no astro:content dependency.
const DATE_LOCALE_MAP: Record<Locale, string> = { es: 'es-ES', en: 'en-US' }

function formatSearchResultDate(date: Date, lang: Locale): string {
  if (Number.isNaN(date.getTime())) return ''
  const locale = DATE_LOCALE_MAP[lang] ?? DATE_LOCALE_MAP.en
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/** Context the populate script needs but the JSON catalog does not carry. */
export interface SearchResultContext {
  pathname: string
  lang: Locale
  categoryLabels: Record<string, string>
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string
): T {
  const el = root.querySelector(selector)
  if (!el) {
    throw new Error(`Blog search template missing ${selector}`)
  }
  return el as T
}

function applyUmamiAttrs(el: HTMLElement, attrs: UmamiAttrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value) el.setAttribute(key, value)
  }
}

function appendCategoryPill(
  list: HTMLElement,
  categoryTemplate: HTMLTemplateElement,
  category: string,
  context: SearchResultContext
): void {
  const fragment = categoryTemplate.content.cloneNode(true) as DocumentFragment
  const pill = fragment.querySelector('span')
  if (!pill) return
  pill.textContent = context.categoryLabels[category] ?? category
  list.append(fragment)
}

/**
 * Clone `#blog-search-result-template` and fill slots from a catalog entry.
 * Markup lives in BlogSearchResultTemplate.astro — not built here.
 */
export function createSearchResultRow(
  entry: BlogSearchEntry,
  rowTemplate: HTMLTemplateElement,
  categoryTemplate: HTMLTemplateElement,
  context: SearchResultContext
): HTMLLIElement {
  const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment
  const row = requireElement<HTMLLIElement>(fragment, 'li')

  const link = requireElement<HTMLAnchorElement>(row, '[data-blog-search-link]')
  link.href = entry.postPath
  link.textContent = entry.title
  applyUmamiAttrs(
    link,
    buildUmamiAttrs({
      pathname: context.pathname,
      lang: context.lang,
      label: 'button_card',
      baseComponent: 'blog_card',
      href: entry.postPath,
      linkText: entry.title
    })
  )

  requireElement(row, '[data-blog-search-snippet]').textContent =
    entry.descriptionSnippet

  const categoriesWrap = requireElement<HTMLElement>(
    row,
    '[data-blog-search-categories]'
  )
  if (entry.categories.length > 0) {
    entry.categories.forEach((category) =>
      appendCategoryPill(categoriesWrap, categoryTemplate, category, context)
    )
    categoriesWrap.hidden = false
  }

  const dateEl = requireElement<HTMLTimeElement>(row, '[data-blog-search-date]')
  dateEl.dateTime = entry.date
  dateEl.textContent = formatSearchResultDate(
    new Date(entry.date),
    context.lang
  )

  const thumbnailWrap = requireElement<HTMLElement>(
    row,
    '[data-blog-search-thumbnail-wrap]'
  )
  if (entry.thumbnail) {
    const img = requireElement<HTMLImageElement>(
      row,
      '[data-blog-search-thumbnail]'
    )
    img.src = entry.thumbnail.src
    img.alt = entry.thumbnail.alt
    thumbnailWrap.hidden = false
  }

  return row
}
