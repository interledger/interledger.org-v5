import { ui } from '@/data/ui'
import {
  locales,
  type Locale,
  localeSchema,
  defaultLocale,
  switcherLocales
} from '@/utils/locales'

export { locales, type Locale, localeSchema, defaultLocale, switcherLocales }

type UiLocale = keyof typeof ui
const defaultUiLocale = defaultLocale as UiLocale

export type UiKey = keyof (typeof ui)[typeof defaultUiLocale]

export function useTranslations(lang: Locale) {
  return function t(key: UiKey, values: Record<string, string | number> = {}) {
    const activeLang = (lang in ui ? lang : defaultLocale) as UiLocale
    const translations = ui[activeLang] as Partial<Record<UiKey, string>>
    let text = translations[key] || ui[defaultUiLocale][key]

    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }

    return text
  }
}

export {
  buildRoutePath,
  normalizeBasePath,
  COLLECTION_INDEX_SLUG,
  translatePath
} from '@/utils/translatePath'
export { HOME_CONTENT_SLUG } from '@/utils/routes'
