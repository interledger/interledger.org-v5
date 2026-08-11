const HREF_LIKE_FIELDS = new Set([
  'href',
  'link',
  'ctaLink',
  'primaryButtonLink',
  'secondaryButtonLink'
])

const PATH_SEGMENT_FIELDS = new Set(['pathSlug', 'slug'])

const ABSOLUTE_OR_SPECIAL_HREF = /^(https?:)?\/\/|^(mailto|tel):|^#/i

export function ensureLeadingSlash(value: string): string {
  if (!value || ABSOLUTE_OR_SPECIAL_HREF.test(value)) return value
  return value.startsWith('/') ? value : `/${value}`
}

export function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

export function normalizeRelativeLinksInDocumentData(data: unknown): void {
  if (Array.isArray(data)) {
    data.forEach(normalizeRelativeLinksInDocumentData)
    return
  }
  if (typeof data !== 'object' || data === null) return

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      if (HREF_LIKE_FIELDS.has(key)) {
        ;(data as Record<string, unknown>)[key] = ensureLeadingSlash(value)
      } else if (PATH_SEGMENT_FIELDS.has(key)) {
        ;(data as Record<string, unknown>)[key] = normalizePathSegment(value)
      }
    } else {
      normalizeRelativeLinksInDocumentData(value)
    }
  }
}
