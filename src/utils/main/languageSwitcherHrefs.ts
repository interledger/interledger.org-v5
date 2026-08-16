import { switcherLocales, type Locale } from './locales'
import { translationMap } from './translationMapData'
import { localizeRoute, normalizeBasePath } from './routes'
import { buildRoutePath } from './translatePath'
import { CATEGORY_SEGMENT, blogRouteShape } from './tagFilter'
import { podcastRouteShape } from './podcastPagination'
import { summitRouteShape } from './summit-talks-speakers'
import type { PaginatedRouteShape } from './paginatedRouteShape'

function isBlogPath(basePath: string): boolean {
  return basePath.endsWith('/blog')
}

/**
 * Every paginated section on the site registers its shape here (each shape
 * lives next to the pagination code it describes — see PaginatedRouteShape).
 * Adding a new paginated route means adding its shape to its own module and
 * registering it in this one list — nothing else in this file needs to change.
 */
const PAGINATED_ROUTE_SHAPES: PaginatedRouteShape[] = [
  blogRouteShape,
  podcastRouteShape,
  summitRouteShape
]

/**
 * True when `slug`'s trailing digit (if any) is safe to treat as a page
 * number, rather than part of a real content pathSlug (e.g. a numeric
 * category name or a summit year) that just happens to look like one.
 */
function hasStrippablePageNumber(basePath: string, parts: string[]): boolean {
  const last = parts.at(-1)
  if (!last || !/^\d+$/.test(last) || Number(last) <= 0) return false

  const shape = PAGINATED_ROUTE_SHAPES.find((s) => s.matches(basePath, parts))
  return shape ? shape.isValidListingPrefix(parts.slice(0, -1)) : false
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
} {
  const parts = slug.split('/').filter(Boolean)

  const categoryIdx = parts.indexOf(CATEGORY_SEGMENT)
  const langIdx = parts.indexOf('lang')
  return {
    term: categoryIdx >= 0 ? parts[categoryIdx + 1] : undefined,
    contentLang: langIdx >= 0 ? (parts[langIdx + 1] as Locale) : undefined
  }
}

function buildBlogSwitchHref(
  basePath: string,
  slug: string,
  targetLocale: Locale
): string {
  const { term, contentLang } = parseBlogSlug(slug)
  const targetContentLang = contentLang ?? targetLocale
  const hasExplicitLang = contentLang !== undefined
  let href = localizeRoute(normalizeBasePath(basePath), targetLocale)
  if (term) {
    href += `/${CATEGORY_SEGMENT}/${term}`
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
