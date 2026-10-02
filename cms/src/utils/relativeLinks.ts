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

/**
 * An absolute URL inside free text. Stops at whitespace, quotes, brackets and
 * commas, so a Markdown target `](url)`, a Markdown title `(url "t")`, an HTML
 * attribute and each entry of a srcset all end where the URL does.
 */
const URL_IN_TEXT = /https?:\/\/[^\s"'()<>,]+/gi

/**
 * Reduce every absolute URL to our own upload path inside free text, leaving
 * the rest of the text byte for byte.
 *
 * The CKEditor plugin prefixes `window.strapi.backendURL` onto every image and
 * file it inserts, whether dragged, pasted or picked from the media library,
 * and has no option to stop it. Left in place, the link records whichever CMS
 * the editor happened to use (localhost included), loads from the firewalled
 * origin instead of the deployed copy, and reads as external to the image
 * optimizer, the image audit and the link validator.
 *
 * Matched by path, like `stripUploadOrigin`: if `STRAPI_UPLOADS_BASE_URL` ever
 * points uploads at a CDN, that origin is stripped too.
 */
export function stripUploadOriginsInText(text: string): string {
  return text.replace(URL_IN_TEXT, stripUploadOrigin)
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
      } else {
        // Every other string, so each CKEditor field is covered wherever it
        // sits (components, dynamic zones) without a field list to drift.
        ;(data as Record<string, unknown>)[key] =
          stripUploadOriginsInText(value)
      }
    } else {
      normalizeRelativeLinksInDocumentData(value)
    }
  }
}
