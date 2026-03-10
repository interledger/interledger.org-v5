import { defaultLocale, locales, type Locale } from './i18'

function normalizeBasePath(basePath: string): string {
  const normalized = basePath.replace(/\/+$/g, '')
  return normalized || '/'
}

export function stripLocaleFromEntryId(entryId: string): string {
  const normalized = entryId.replace(/^\/+|\/+$/g, '')

  for (const locale of locales) {
    const prefix = `${locale}/`
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length)
    }
  }

  return normalized
}

function joinPath(basePath: string, suffix: string): string {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedSuffix = suffix.replace(/^\/+/g, '')
  return `${normalizedBasePath}/${normalizedSuffix}`
}

export function buildBlogIndexLanguageHrefs(
  basePath: string
): Record<Locale, string> {
  const normalizedBasePath = normalizeBasePath(basePath)

  return locales.reduce(
    (acc, locale) => {
      acc[locale] =
        locale === defaultLocale
          ? normalizedBasePath
          : `/${locale}${normalizedBasePath}`
      return acc
    },
    {} as Record<Locale, string>
  )
}

export function buildBlogPostLanguageHrefs(
  basePath: string,
  entryId: string
): Record<Locale, string> {
  const normalizedBasePath = normalizeBasePath(basePath)
  const defaultEntryId = stripLocaleFromEntryId(entryId)

  return locales.reduce(
    (acc, locale) => {
      acc[locale] =
        locale === defaultLocale
          ? joinPath(normalizedBasePath, defaultEntryId)
          : `/${locale}${joinPath(normalizedBasePath, defaultEntryId)}`
      return acc
    },
    {} as Record<Locale, string>
  )
}
