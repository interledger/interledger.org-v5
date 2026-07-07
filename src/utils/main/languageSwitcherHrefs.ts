import { switcherLocales, type Locale } from './locales'
import { translationMap } from './translationMapData'
import { localizeRoute, normalizeBasePath } from './routes'
import { buildRoutePath } from './translatePath'

function isBlogPath(basePath: string): boolean {
  return basePath.endsWith('/blog')
}

function parseBlogSlug(slug: string): {
  term?: string
  contentLang?: Locale
  segment?: 'tag' | 'category'
} {
  const parts = slug.split('/').filter(Boolean)
  const last = parts.at(-1)
  const relevant = last && /^\d+$/.test(last) ? parts.slice(0, -1) : parts

  const tagIdx = relevant.indexOf('tag')
  const categoryIdx = relevant.indexOf('category')
  const termIdx = tagIdx >= 0 ? tagIdx : categoryIdx
  const langIdx = relevant.indexOf('lang')
  return {
    term: termIdx >= 0 ? relevant[termIdx + 1] : undefined,
    contentLang: langIdx >= 0 ? (relevant[langIdx + 1] as Locale) : undefined,
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
  const fullSlug = normalizeBasePath(
    buildRoutePath(currentBasePath, currentSlug)
  ).slice(1)
  const entry = translationMap[currentSlug] ?? translationMap[fullSlug]

  return Object.fromEntries(
    switcherLocales.map((locale) => {
      if (isBlogPath(currentBasePath)) {
        const { term, contentLang } = parseBlogSlug(currentSlug)
        if (term || contentLang) {
          return [
            locale,
            buildBlogSwitchHref(currentBasePath, currentSlug, locale)
          ]
        }
      }

      const slug = entry?.[locale] ?? currentSlug
      const path =
        entry && translationMap[fullSlug] && !translationMap[currentSlug]
          ? buildRoutePath('', slug)
          : buildRoutePath(currentBasePath, slug)
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
