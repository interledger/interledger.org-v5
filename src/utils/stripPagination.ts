export default function stripPagination(path: string): string {
  if (!path || path === '/') return '/'

  const normalized = path.replace(/\/+$/, '')

  const parts = normalized.split('/').filter(Boolean)

  const last = parts.at(-1)

  if (last && /^\d+$/.test(last) && Number(last) > 0) {
    parts.pop()
  }

  return '/' + parts.join('/')
}
