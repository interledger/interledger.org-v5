import { joinPagePath } from '../shared/url'
import type { Locale } from './locales'
import { ROUTE_BASES, localizeRoute } from './routes'
import { currentSummitYear } from './sessionize'

/** The summit landing page itself, with the locale prefix: `/summit/`, `/es/summit/`. */
export function summitBaseHref(locale: Locale): string {
  return localizeRoute(ROUTE_BASES['summit-pages'], locale)
}

/**
 * Landing page for one summit year. The current summit lives at `/summit/`,
 * earlier ones at `/summit/{year}/`.
 */
export function summitYearHref(year: string, locale: Locale): string {
  return joinPagePath(
    summitBaseHref(locale),
    year === currentSummitYear ? '' : year
  )
}
