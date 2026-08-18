import { locales } from './locales'
import { hasStrippablePageNumber } from './paginatedRouteShape'

/**
 * `hasStrippablePageNumber` expects a section basePath (e.g. `/blog`) and the
 * slug parts after it, already split by the caller. stripPagination only gets
 * a raw pathname, which may additionally carry a one-segment locale prefix
 * (e.g. `/es/blog/...`) that isn't a section at all — so skip a leading
 * segment that's a real locale code before treating the next segment as the
 * section root.
 */
function isStrippablePath(parts: string[]): boolean {
  const sectionOffset = locales.includes(parts[0]) ? 1 : 0
  return hasStrippablePageNumber(
    `/${parts[sectionOffset]}`,
    parts.slice(sectionOffset + 1)
  )
}

export default function stripPagination(path: string): string {
  if (!path || path === '/') return '/'

  const normalized = path.replace(/\/+$/, '')

  const parts = normalized.split('/').filter(Boolean)

  if (isStrippablePath(parts)) {
    parts.pop()
  }

  return '/' + parts.join('/')
}
