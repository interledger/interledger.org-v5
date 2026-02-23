import { i18n } from "astro:config/client";
import { toCodes } from "astro:i18n";

export const locales = toCodes(i18n!.locales); 
export const defaultLocale = i18n?.defaultLocale


export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/')

  if (locales.includes(lang)) {
    return lang
  }

  return defaultLocale
}