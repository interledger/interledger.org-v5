import { i18n } from 'astro:config/client'
import { toCodes } from 'astro:i18n'

const localeCodes = Array.from(new Set(toCodes(i18n!.locales)))
export const locales = localeCodes as [string, ...string[]]
export type Locale = (typeof locales)[number]
export const defaultLocale = i18n!.defaultLocale as Locale
// Forces defaultLocale to display first for the LanguageSwitcher
export const switcherLocales = [
  defaultLocale,
  ...locales.filter((locale) => locale !== defaultLocale)
] as [Locale, ...Locale[]]
