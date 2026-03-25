import { defaultLocale, type Locale } from '@/utils/i18'

export const HOME_SLUG = 'home'

export const ROUTE_BASES = {
  'foundation-pages': '',
  'foundation-blog': '/blog',
  'developers-blog': '/developers/blog',
  'summit-pages': '/summit'
} as const

export type RouteCollection = keyof typeof ROUTE_BASES

function normalizeBasePath(basePath: string): string {
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
