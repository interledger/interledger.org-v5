import { ui } from '../../data/ui'

const TABLE_SCROLL_LABEL_KEY = 'prose.table_scroll_region' as const
const DEFAULT_LOCALE = 'en' as const

/** Localized accessible name for horizontally scrollable table regions. */
export function getTableScrollAriaLabel(lang?: string): string {
  const locale =
    lang && lang in ui ? (lang as keyof typeof ui) : DEFAULT_LOCALE
  return ui[locale][TABLE_SCROLL_LABEL_KEY]
}
