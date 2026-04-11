import { i18n } from 'astro:config/client'
import { toCodes } from 'astro:i18n'
import { z } from 'astro:content'
import { ui } from './ui'

const localeCodes = Array.from(new Set(toCodes(i18n!.locales)))
export const locales = localeCodes as [string, ...string[]]
export type Locale = (typeof locales)[number]
export const localeSchema = z.enum(locales as [Locale, ...Locale[]])
export const defaultLocale = i18n!.defaultLocale as Locale
type UiLocale = keyof typeof ui
// Forces defaultLocale to display first for the LanguageSwitcher
export const switcherLocales = [
  defaultLocale,
  ...locales.filter((locale) => locale !== defaultLocale)
] as [Locale, ...Locale[]]

export type UiKey = keyof (typeof ui)['en']

export function getLangFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/')

  if (locales.includes(lang as Locale)) {
    return lang as Locale
  }

  return defaultLocale
}

export function useTranslations(lang: Locale) {
  return function t(key: UiKey, values: Record<string, string | number> = {}) {
    const activeLang = (lang in ui ? lang : defaultLocale) as UiLocale
    const fallbackLang = (
      defaultLocale in ui ? defaultLocale : 'en'
    ) as UiLocale
    const translations = ui[activeLang] as Partial<Record<UiKey, string>>
    let text = translations[key] || ui[fallbackLang][key]

    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }

    return text
  }
}
