import { defaultLocale, locales, type Locale } from '../i18/utils'

type LocalizedEntry = {
  id: string
  data: {
    lang: Locale
    pathSlug: string
  }
}

const ROOT_SLUGS = new Set(['', 'home'])

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

function toLocalizedHref(lang: Locale, pathSlug: string): string {
  const slug = cleanSlug(pathSlug)
  if (ROOT_SLUGS.has(slug)) {
    return lang === defaultLocale ? '/' : `/${lang}/`
  }
  return lang === defaultLocale ? `/${slug}` : `/${lang}/${slug}`
}

export function getLocalizedPageHrefs<T extends LocalizedEntry>(
  pages: T[],
  currentPage: T
): Record<Locale, string> {
  const translationKey = getTranslationKey(currentPage.id)
  const localizedPagesByLang = new Map<Locale, T>()

  for (const page of pages) {
    if (getTranslationKey(page.id) === translationKey) {
      localizedPagesByLang.set(page.data.lang, page)
    }
  }

  return locales.reduce(
    (acc, locale) => {
      const localizedPage = localizedPagesByLang.get(locale)
      acc[locale] = localizedPage
        ? toLocalizedHref(locale, localizedPage.data.pathSlug)
        : toLocalizedHref(locale, 'home')
      return acc
    },
    {} as Record<Locale, string>
  )
}
