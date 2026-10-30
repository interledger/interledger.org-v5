import type { BlogSearchEntry } from '@/utils/main/blogSearch'
import type { BlogSearchThumbnail } from '@/types/blog'
import type { Locale } from '@/utils/main/locales'
import { buildUmamiAttrs, type UmamiAttrs } from '@/utils/main/umami'

// Not @/utils/main/time's formatDate: it pulls in defaultLocale from
// main/locales.ts, which imports `z` from `astro:content` at module scope —
// a server-only import that can't be tree-shaken out of the client bundle
// even when only the (type-erased) Locale is used. This mirrors its output
// with no astro:content dependency.
const DATE_LOCALE_MAP: Record<Locale, string> = { es: 'es-ES', en: 'en-US' }

/**
 * Frontmatter dates are date-only, so they arrive as UTC midnight. Formatting
 * that in the viewer's zone rolls it back a day everywhere west of Greenwich
 * — the whole Americas would see a search row dated one day before the same
 * post's byline, which the build renders in UTC. Pinning the zone keeps the
 * authored date, and matches how the roadmap and grantee dates are formatted.
 */
export function formatSearchResultDate(date: Date, lang: Locale): string {
  if (Number.isNaN(date.getTime())) return ''
  const locale = DATE_LOCALE_MAP[lang] ?? DATE_LOCALE_MAP.en
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/** Context the populate script needs but the JSON catalog does not carry. */
export interface SearchResultContext {
  pathname: string
  lang: Locale
  categoryLabels: Record<string, string>
  /** Localized "{readingTime} min read". */
  readingTimeLabel: string
  /** Localized "{author}'s profile (opens in a new tab)". */
  authorProfileLabel: string
}

export interface SearchResultBylineLinkModel {
  href: string
  ariaLabel: string
  umami: UmamiAttrs
}

/** Values `applyByline` writes into the template; `null` drops that part. */
export interface SearchResultBylineModel {
  author: {
    name: string
    avatarSrc: string | null
    link: SearchResultBylineLinkModel | null
  } | null
  readingTimeLabel: string
}

/**
 * Split/join rather than `replace(token, value)`: a string replacement expands
 * `$&`, `$'` and friends, so an author name containing one would corrupt the
 * label.
 */
function fillToken(label: string, token: string, value: string): string {
  return label.split(`{${token}}`).join(value)
}

/** Pure byline payload, mirroring BlogCardByline. */
export function searchResultBylineModel(
  entry: BlogSearchEntry,
  context: SearchResultContext
): SearchResultBylineModel {
  const readingTimeLabel = fillToken(
    context.readingTimeLabel,
    'readingTime',
    String(entry.readingTime)
  )
  const { author } = entry
  if (!author) return { author: null, readingTimeLabel }

  const link = author.href
    ? {
        href: author.href,
        ariaLabel: fillToken(context.authorProfileLabel, 'author', author.name),
        umami: buildUmamiAttrs({
          pathname: context.pathname,
          lang: context.lang,
          label: 'link',
          baseComponent: 'blog',
          href: author.href,
          linkText: author.name
        })
      }
    : null

  return {
    author: { name: author.name, avatarSrc: author.avatarSrc, link },
    readingTimeLabel
  }
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

/**
 * Point the row's <img> at the thumbnail, blurring up from the LQIP when the
 * catalog carries one.
 *
 * The placeholder is a CSS background sitting behind the image, and CSS has no
 * "loaded" signal, so it has to be cleared in JS — otherwise a source with
 * transparency keeps showing the blur through its own alpha channel forever.
 * OptimizedImage.astro ships the same logic for server-rendered images, but it
 * only scans the DOM once at startup, so rows built later need their own
 * handler. Cleared on `load` only: a failed image should keep the blur rather
 * than collapse to an empty box.
 */
function applyThumbnail(
  img: HTMLImageElement,
  thumbnail: BlogSearchThumbnail
): void {
  const { blur } = thumbnail
  if (blur) {
    // Validated against BLUR_PLACEHOLDER_RE when the catalog was built, so it
    // cannot break out of the url().
    img.style.backgroundImage = `url('${blur}')`
    img.dataset.blurPlaceholder = ''
  }

  // Before `src`, so the preload scanner picks the candidate the sizes
  // attribute in BlogSearchResultTemplate.astro selects rather than starting
  // the fallback fetch first.
  if (thumbnail.srcset) img.srcset = thumbnail.srcset
  img.src = thumbnail.src
  img.alt = thumbnail.alt

  if (!blur) return
  const dropBlurPlaceholder = () => {
    img.style.backgroundImage = 'none'
    img.removeAttribute('data-blur-placeholder')
  }
  // `complete` is also true for an image that has already *failed*, so it
  // cannot stand alone here: a cached 404 would strip the placeholder and
  // leave an empty box. A decoded image always reports a non-zero
  // naturalWidth, so the pair distinguishes loaded from failed.
  if (img.complete && img.naturalWidth > 0) {
    dropBlurPlaceholder()
  } else {
    img.addEventListener('load', dropBlurPlaceholder, { once: true })
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

function applyByline(row: HTMLElement, model: SearchResultBylineModel): void {
  requireElement(row, '[data-blog-search-reading-time]').textContent =
    model.readingTimeLabel

  const authorEl = requireElement<HTMLAnchorElement>(
    row,
    '[data-blog-search-author]'
  )
  const { author } = model
  if (!author) {
    authorEl.remove()
    return
  }

  requireElement(authorEl, '[data-blog-search-author-name]').textContent =
    author.name

  // Removed, never hidden: BlogCardByline renders only one of the two, and
  // every cloned fallback icon shares one clipPath id. `url(#id)` resolves to
  // the first match in the document, so a hidden icon there breaks the clip on
  // every visible one after it.
  const avatar = requireElement<HTMLImageElement>(
    authorEl,
    '[data-blog-search-author-avatar]'
  )
  const fallback = requireElement(
    authorEl,
    '[data-blog-search-author-fallback]'
  )
  if (author.avatarSrc) {
    avatar.src = author.avatarSrc
    fallback.remove()
  } else {
    avatar.remove()
  }

  // Without an href the anchor is a placeholder link: not focusable and no
  // link role, so it reads like BlogCardByline's unlinked <div>.
  if (!author.link) return
  authorEl.href = author.link.href
  authorEl.setAttribute('aria-label', author.link.ariaLabel)
  applyUmamiAttrs(authorEl, author.link.umami)
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
  applyByline(row, searchResultBylineModel(entry, context))

  const thumbnailWrap = requireElement<HTMLElement>(
    row,
    '[data-blog-search-thumbnail-wrap]'
  )
  if (entry.thumbnail) {
    const img = requireElement<HTMLImageElement>(
      row,
      '[data-blog-search-thumbnail]'
    )
    applyThumbnail(img, entry.thumbnail)
    thumbnailWrap.hidden = false
  }

  return row
}
