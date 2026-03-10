import { i18n } from 'astro:config/client'
import { toCodes } from 'astro:i18n'
import { z } from 'astro:content'

const localeCodes = Array.from(new Set(toCodes(i18n!.locales)))
export const locales = localeCodes as [string, ...string[]]
export type Locale = (typeof locales)[number]
export const localeSchema = z.enum(locales as [Locale, ...Locale[]])
export const defaultLocale = i18n!.defaultLocale as Locale
export const switcherLocales = [
  defaultLocale,
  ...locales.filter((locale) => locale !== defaultLocale)
] as [Locale, ...Locale[]]
