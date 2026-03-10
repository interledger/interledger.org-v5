import { defaultLocale, locales, type Locale } from './i18'

type LocalizedEntry = {
  id: string
  data: {
    locale: Locale
    pathSlug: string
  }
}

const ROOT_SLUGS = new Set(['', 'home'])

type LocalizedHrefBuilder = (locale: Locale, pathSlug: string) => string

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const localePrefixPattern = new RegExp(
  `^(?:${locales.map(escapeRegex).join('|')})/`
)

function getTranslationKey(id: string): string {
  return id.replace(localePrefixPattern, '').replace(/\.[^/.]+$/, '')
}

function cleanSlug(pathSlug: string): string {
  return pathSlug.replace(/^\/+|\/+$/g, '')
}

export function defaultLocalizedHrefBuilder(
  locale: Locale,
  pathSlug: string
): string {
  const slug = cleanSlug(pathSlug)
  if (ROOT_SLUGS.has(slug)) {
    return locale === defaultLocale ? '/' : `/${locale}/`
  }
  return locale === defaultLocale ? `/${slug}` : `/${locale}/${slug}`
}

export function getLocalizedPageHrefs<T extends LocalizedEntry>(
  pages: T[],
  currentPage: T,
  buildHref: LocalizedHrefBuilder = defaultLocalizedHrefBuilder
): Record<Locale, string> {
  const translationKey = getTranslationKey(currentPage.id)
  const localizedPagesByLang = new Map<Locale, T>()

  for (const page of pages) {
    if (getTranslationKey(page.id) === translationKey) {
      localizedPagesByLang.set(page.data.locale, page)
    }
  }

  return locales.reduce(
    (acc, locale) => {
      const localizedPage = localizedPagesByLang.get(locale)
      acc[locale] = localizedPage
        ? buildHref(locale, localizedPage.data.pathSlug)
        : buildHref(locale, currentPage.data.pathSlug)
      return acc
    },
    {} as Record<Locale, string>
  )
}
