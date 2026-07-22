import { defaultLocale, type Locale } from './locales'

export const HOME_CONTENT_SLUG = 'home'

/** pathSlug for the primary grant overview at `/grants/our-grantmaking`. */
export const GRANT_OVERVIEW_PRIMARY_SLUG = 'our-grantmaking'

export const ROUTE_BASES = {
  'foundation-pages': '',
  'foundation-blog': '/blog',
  'summit-pages': '/summit',
  'grant-pages': '/grant',
  'grant-overview-pages': '/grants',
  // Profiles, faqs and reports use section-relative pathSlugs (e.g. 'fellowship/andria-barrett').
  // The empty base means the translation map indexes them by their pathSlug directly;
  // routeContextFromPathname derives currentBasePath from the actual URL section.
  profiles: '',
  faqs: '',
  reports: ''
} as const

export type RouteCollection = keyof typeof ROUTE_BASES

export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return ''
  return basePath.startsWith('/') ? basePath : `/${basePath}`
}

/** Catch-all `page` param for grant-overview-pages static paths. */
export function grantOverviewRouteParam(pathSlug: string): string {
  return `grants/${pathSlug}`
}

/** URL path (no locale prefix) for the primary grant overview hub. */
export function grantOverviewHubPath(): string {
  return grantOverviewRouteParam(GRANT_OVERVIEW_PRIMARY_SLUG)
}

export function localizeRoute(basePath: string, locale: Locale): string {
  const normalizedBasePath = normalizeBasePath(basePath)

  if (locale === defaultLocale) {
    return normalizedBasePath || '/'
  }

  return normalizedBasePath ? `/${locale}${normalizedBasePath}` : `/${locale}`
}
