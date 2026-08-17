const HREF_LIKE_FIELDS = new Set([
  'href',
  'link',
  'ctaLink',
  'primaryButtonLink',
  'secondaryButtonLink',
  'authorLink'
])

const PATH_SEGMENT_FIELDS = new Set(['pathSlug', 'slug'])

const ABSOLUTE_OR_SPECIAL_HREF = /^(https?:)?\/\/|^(mailto|tel):|^#/i

/**
 * Where the upload provider writes every file. Keep in step with
 * `UPLOAD_SUBDIR` in `src/index.ts`.
 */
const UPLOAD_PATH_PREFIX = '/uploads/img/original/'

/**
 * Reduce an absolute URL that points at our own upload path back to the path.
 *
 * Uploads live in the repo and the site serves them. The media library's Copy
 * Link button hands the editor an absolute URL on the CMS origin, which is
 * firewalled, so pasting it into a CTA produces a link that opens a new tab
 * against a host that will not answer. An editor has no way to tell from the
 * admin that the value is wrong (INTORG-938).
 *
 * Matched on the full upload prefix rather than `/uploads/` alone, so a real
 * external link that happens to use an `/uploads/` path is left alone.
 */
export function stripUploadOrigin(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    // Not a URL we can read. Leave it exactly as the editor typed it.
    return value
  }
  if (!parsed.pathname.startsWith(UPLOAD_PATH_PREFIX)) return value
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

export function ensureLeadingSlash(value: string): string {
  if (!value || ABSOLUTE_OR_SPECIAL_HREF.test(value)) return value
  return value.trim().startsWith('/') ? value : `/${value}`
}

export function normalizePathSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '')
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
        ;(data as Record<string, unknown>)[key] = ensureLeadingSlash(
          stripUploadOrigin(value)
        )
      } else if (PATH_SEGMENT_FIELDS.has(key)) {
        ;(data as Record<string, unknown>)[key] = normalizePathSegment(value)
      }
    } else {
      normalizeRelativeLinksInDocumentData(value)
    }
  }
}
