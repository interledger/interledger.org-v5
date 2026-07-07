import { switcherLocales, defaultLocale, type Locale } from './locales'
import { translationMap } from './translationMapData'
import { localizeRoute } from './routes'
import { buildRoutePath } from './translatePath'

export type HreflangMeta = {
  locale: Locale
  url: string
}

export type CanonicalMeta = {
  canonical: string
  hreflang: HreflangMeta[]
  xDefault: string
}

export function buildCanonicalMeta(
  site: URL,
  routeLocale: Locale,
  currentSlug: string,
  currentBasePath: string
): CanonicalMeta {
  const fullSlug = buildRoutePath(currentBasePath, currentSlug).replace(/^\//, '')
  const entry = translationMap[currentSlug] ?? translationMap[fullSlug]

  function resolveHref(locale: Locale): string {
    const slug = entry?.[locale] ?? currentSlug
    const path =
      entry && translationMap[fullSlug] && !translationMap[currentSlug]
        ? buildRoutePath('', slug)
        : buildRoutePath(currentBasePath, slug)
    return new URL(localizeRoute(path, locale), site).href
  }

  const hreflang: HreflangMeta[] = switcherLocales.map((locale) => ({
    locale,
    url: resolveHref(locale)
  }))

  const canonical = resolveHref(routeLocale)
  const xDefault = resolveHref(defaultLocale)

  return { canonical, hreflang, xDefault }
}
