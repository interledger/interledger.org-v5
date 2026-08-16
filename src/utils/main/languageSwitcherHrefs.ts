import { switcherLocales, type Locale } from './locales'
import { translationMap } from './translationMapData'
import { localizeRoute, normalizeBasePath, PODCAST_PAGE_SLUG } from './routes'
import { buildRoutePath } from './translatePath'

function isBlogPath(basePath: string): boolean {
  return basePath.endsWith('/blog')
}

// Blog/podcast taxonomy filter URLs are `.../<segment>/<name>` (page 1) or
// `.../<segment>/<name>/<n>` (page n>1) — the segment keyword itself, e.g.
// 'category'/'tag', names the filter.
const TAXONOMY_SEGMENTS = new Set(['category', 'tag'])

// Summit paginates /summit/<year>/talks and /summit/<year>/speakers, but its
// bare year page (/summit/<year>) is itself a real, non-paginated pathSlug
// that happens to be numeric — so a trailing digit alone can't tell them
// apart there. Only strip it when the segment right before it names one of
// summit's actual paginated listings.
const SUMMIT_PAGINATED_LISTING_SEGMENTS = new Set(['talks', 'speakers'])

/**
 * True when `slug`'s trailing digit (if any) is safe to treat as a page
 * number for this basePath, rather than part of a real content pathSlug.
 *
 * `nameOffset` is where a taxonomy filter's own <name> segment sits, counted
 * from the front of `parts` — 1 for blog (`category/<name>`), 2 for podcast
 * (`podcast/category/<name>`), since podcast's slug carries an extra leading
 * 'podcast' segment (it isn't registered in ROUTE_BASES). When `parts` is
 * exactly that long, the trailing segment IS the filter's own name — which
 * might itself look numeric — not a page number, so it must not be stripped.
 */
function isBareTaxonomyName(parts: string[], nameOffset: number): boolean {
  return (
    TAXONOMY_SEGMENTS.has(parts[nameOffset - 1]) &&
    parts.length === nameOffset + 1
  )
}

function hasStrippablePageNumber(basePath: string, parts: string[]): boolean {
  const last = parts.at(-1)
  if (!last || !/^\d+$/.test(last) || Number(last) <= 0) return false

  if (isBlogPath(basePath)) return !isBareTaxonomyName(parts, 1)
  if (basePath === '' && parts[0] === PODCAST_PAGE_SLUG) {
    return !isBareTaxonomyName(parts, 2)
  }
  if (basePath.endsWith('/summit')) {
    return SUMMIT_PAGINATED_LISTING_SEGMENTS.has(parts.at(-2) ?? '')
  }
  return false
}

/**
 * Drops a trailing pagination segment from a slug (not a full pathname), e.g.
 * 'category/announcements/2' -> 'category/announcements', '2' -> ''. Applied
 * before building a switch-language href so a paginated page (/blog/2,
 * /podcast/2, /podcast/category/future-money/2, /summit/2025/talks/2, ...)
 * always switches to page 1 of the target locale instead of preserving a page
 * number that section may not have.
 */
function stripSlugPagination(basePath: string, slug: string): string {
  const parts = slug.split('/').filter(Boolean)
  if (!hasStrippablePageNumber(basePath, parts)) return slug
  return parts.slice(0, -1).join('/')
}

/** Expects a slug with any trailing pagination segment already stripped. */
function parseBlogSlug(slug: string): {
  term?: string
  contentLang?: Locale
  segment?: 'tag' | 'category'
} {
  const parts = slug.split('/').filter(Boolean)

  const tagIdx = parts.indexOf('tag')
  const categoryIdx = parts.indexOf('category')
  const termIdx = tagIdx >= 0 ? tagIdx : categoryIdx
  const langIdx = parts.indexOf('lang')
  return {
    term: termIdx >= 0 ? parts[termIdx + 1] : undefined,
    contentLang: langIdx >= 0 ? (parts[langIdx + 1] as Locale) : undefined,
    segment: tagIdx >= 0 ? 'tag' : categoryIdx >= 0 ? 'category' : undefined
  }
}

function buildBlogSwitchHref(
  basePath: string,
  slug: string,
  targetLocale: Locale
): string {
  const { term, contentLang, segment } = parseBlogSlug(slug)
  const targetContentLang = contentLang ?? targetLocale
  const hasExplicitLang = contentLang !== undefined
  let href = localizeRoute(normalizeBasePath(basePath), targetLocale)
  if (term) {
    href += `/${segment ?? 'category'}/${term}`
  }
  if (hasExplicitLang) href += `/lang/${targetContentLang}`
  return href
}

export function getLanguageSwitcherHrefs(
  currentSlug: string,
  currentBasePath: string
): Record<Locale, string> {
  // Switching locale always targets page 1 of the current section — a
  // paginated page number from one locale's listing has no guarantee of
  // existing (or meaning the same thing) in the other.
  const slug = stripSlugPagination(currentBasePath, currentSlug)
  const fullSlug = normalizeBasePath(
    buildRoutePath(currentBasePath, slug)
  ).slice(1)
  const entry = translationMap[slug] ?? translationMap[fullSlug]

  return Object.fromEntries(
    switcherLocales.map((locale) => {
      if (isBlogPath(currentBasePath)) {
        const { term, contentLang } = parseBlogSlug(slug)
        if (term || contentLang) {
          return [locale, buildBlogSwitchHref(currentBasePath, slug, locale)]
        }
      }

      const targetSlug = entry?.[locale] ?? slug
      const path =
        entry && translationMap[fullSlug] && !translationMap[slug]
          ? buildRoutePath('', targetSlug)
          : buildRoutePath(currentBasePath, targetSlug)
      const href = localizeRoute(path, locale)
      return [locale, href]
    })
  ) as Record<Locale, string>
}

export function getAlternateLocale(currentLocale: Locale): Locale | undefined {
  return switcherLocales.find((locale) => locale !== currentLocale)
}

export function getAlternateLocaleHref(
  currentLocale: Locale,
  currentSlug: string,
  currentBasePath: string
): string | undefined {
  const alternateLocale = getAlternateLocale(currentLocale)
  if (!alternateLocale) return undefined

  return getLanguageSwitcherHrefs(currentSlug, currentBasePath)[alternateLocale]
}
