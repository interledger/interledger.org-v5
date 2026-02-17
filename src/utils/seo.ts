export type AlternateLink = {
  href: string
  hreflang: string
}

function normalizePath(pathname: string): string {
  if (!pathname) return '/'
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function inferLangFromPath(pathname: string): string {
  const path = normalizePath(pathname)
  if (path === '/es' || path.startsWith('/es/')) return 'es'
  if (path === '/blog/es' || path.startsWith('/blog/es/')) return 'es'
  if (path === '/developers/blog/es' || path.startsWith('/developers/blog/es/')) return 'es'
  return 'en'
}

export function resolveLang(override: string | undefined, pathname: string): string {
  return override ?? inferLangFromPath(pathname)
}

export function toOgLocale(lang: string): string {
  const normalized = lang.toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en_US'
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es_ES'
  return 'en_US'
}

export function buildDefaultAlternates(
  pathname: string,
  site: URL
): AlternateLink[] {
  const path = normalizePath(pathname)
  const make = (p: string) => new URL(p, site).href

  const mappings = [
    { prefix: '/blog' },
    { prefix: '/developers/blog' }
  ]

  for (const { prefix } of mappings) {
    const esPrefix = `${prefix}/es`

    if (path === prefix) {
      return [
        { hreflang: 'en', href: make(path) },
        { hreflang: 'es', href: make(esPrefix) }
      ]
    }

    if (path === esPrefix) {
      return [
        { hreflang: 'en', href: make(prefix) },
        { hreflang: 'es', href: make(path) }
      ]
    }
  }

  return []
}
