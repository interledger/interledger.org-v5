import { defaultLocale, type Locale } from './locales'

export const HOME_CONTENT_SLUG = 'home'

export const ROUTE_BASES = {
  'foundation-pages': '',
  'foundation-blog': '/blog',
  'developers-blog': '/developers/blog',
  'summit-pages': '/summit',
  'grant-pages': '/grant',
  'grant-overview-pages': '/grant',
  // Profiles use section-relative pathSlugs (e.g. 'fellowship/andria-barrett').
  // The empty base means the translation map indexes them by their pathSlug directly;
  // routeContextFromPathname derives currentBasePath from the actual URL section.
  profiles: ''
} as const

export type RouteCollection = keyof typeof ROUTE_BASES

export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return ''
  return basePath.startsWith('/') ? basePath : `/${basePath}`
}

export function localizeRoute(basePath: string, locale: Locale): string {
  const normalizedBasePath = normalizeBasePath(basePath)

  if (locale === defaultLocale) {
    return normalizedBasePath || '/'
  }

  return normalizedBasePath ? `/${locale}${normalizedBasePath}` : `/${locale}`
}
