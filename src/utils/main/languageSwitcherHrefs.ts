import { switcherLocales, type Locale } from './locales'
import { translationMap } from './translationMapData'
import { localizeRoute, normalizeBasePath } from './routes'
import { buildRoutePath } from './translatePath'

function toDefaultSectionHref(locale: Locale, basePath: string): string {
  return localizeRoute(normalizeBasePath(basePath), locale)
}

export function getLanguageSwitcherHrefs(
  currentSlug: string,
  currentBasePath: string
): Record<Locale, string> {
  const entry = translationMap[currentSlug]

  return Object.fromEntries(
    switcherLocales.map((locale) => {
      const slug = entry?.[locale]
      const href = slug
        ? localizeRoute(buildRoutePath(currentBasePath, slug), locale)
        : toDefaultSectionHref(locale, currentBasePath)
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
