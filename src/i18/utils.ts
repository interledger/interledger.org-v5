import { i18n } from 'astro:config/client'
import { toCodes } from 'astro:i18n'
import { z } from 'astro:content'

export const locales = toCodes(i18n!.locales)
export type Locale = (typeof locales)[number]
export const localeSchema = z.enum(locales as [Locale, ...Locale[]])

// TODO remove if unneeded
// export function isLocale(value: string): value is Locale {
//   return locales.includes(value as Locale)
// }

export const defaultLocale = i18n!.defaultLocale as Locale

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/')

  if (locales.includes(lang)) {
    return lang
  }

  return defaultLocale
}
