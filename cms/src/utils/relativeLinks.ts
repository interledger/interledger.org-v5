const HREF_LIKE_FIELDS = new Set([
  'href',
  'link',
  'ctaLink',
  'primaryButtonLink',
  'secondaryButtonLink',
  'authorLink'
])

const PATH_SEGMENT_FIELDS = new Set(['pathSlug', 'slug'])

/**
 * Fields whose value is a single URL, not Markdown: only the origin is cut, so
 * the value never turns into a Markdown link.
 */
const SINGLE_URL_FIELDS = new Set(['url', 'videoUrl', 'externalUrl'])

/**
 * A value that is not a site path: any URL scheme (`https:`, `mailto:`,
 * `ftp:`, `sms:`…), protocol-relative `//host`, or a same-page `#id`.
 * Script-bearing schemes are not exempt: prefixing them with `/` keeps them
 * from ever running as a link.
 */
const ABSOLUTE_OR_SPECIAL_HREF =
  /^(?!(?:javascript|vbscript|data):)[a-z][a-z\d+.-]*:|^\/\/|^#/i

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

/** Fields holding source code, where a URL is an example, not a link. */
const CODE_FIELDS = new Set(['code'])

/** Fenced blocks and inline code spans: example text, never rewritten. */
const MARKDOWN_CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/

/**
 * An absolute URL to our upload path: group 1 the origin, group 2 the path.
 * The host stops at `/`, `?` and `#`, so an external URL whose query or
 * fragment merely mentions the upload path does not match. The scheme is
 * case-insensitive and the path is not, as in `stripUploadOrigin`.
 */
const UPLOAD_URL_IN_TEXT = new RegExp(
  `([hH][tT][tT][pP][sS]?://[^\\s"'()<>,/\\\\?#]+)(${UPLOAD_PATH_PREFIX}[^\\s"'()<>[\\]]*)`,
  'g'
)

/**
 * Inside an HTML tag, where the URL is an attribute value or srcset entry. An
 * escaped `\<` is prose: CKEditor escapes every literal `<` it writes.
 */
const INSIDE_HTML_TAG = /(?<!\\)<[a-zA-Z][^<>]*$/

/** A Markdown link or image destination: `](url` or `](<url`. */
const MARKDOWN_DESTINATION = /\]\(<?$/

/** A reference definition: `[id]: url`. */
const REFERENCE_DEFINITION = /^\s*\[[^\]\n]+\]:\s*<?$/m

/** Unclosed link text on this line: `[Download url`. An escaped `\[` is prose. */
const INSIDE_LINK_TEXT = /(?<!\\)\[[^\]\n]*$/

/**
 * The URL continues a token before it, so it is part of another URL
 * (`?url=https://…`, `web/2020/https://…`) or not a URL at all (`xhttps://…`).
 * Not `_`: CKEditor writes italics with it, and `_https://…_` is prose.
 */
const CONTINUES_PRECEDING_TOKEN = /[A-Za-z0-9/:?&=.%\\-]$/

/** Sentence punctuation a bare URL does not own, as GFM autolinking reads it. */
const TRAILING_PUNCTUATION = /[.,;:!?*_~]+$/

type UploadUrlContext = 'origin' | 'autolink' | 'bare' | 'leave'

function classifyUploadUrl(before: string, after: string): UploadUrlContext {
  if (INSIDE_HTML_TAG.test(before)) return 'origin'
  if (MARKDOWN_DESTINATION.test(before)) return 'origin'
  if (REFERENCE_DEFINITION.test(before.slice(before.lastIndexOf('\n') + 1)))
    return 'origin'
  if (CONTINUES_PRECEDING_TOKEN.test(before)) return 'leave'
  if (INSIDE_LINK_TEXT.test(before)) return 'origin'
  if (before.endsWith('<') && after.startsWith('>')) return 'autolink'
  return 'bare'
}

function toMarkdownLink(path: string): string {
  return `[${path}](${path})`
}

function stripUploadOriginsInProse(segment: string): string {
  let result = ''
  let cursor = 0
  for (const match of segment.matchAll(UPLOAD_URL_IN_TEXT)) {
    const [url, , matchedPath] = match
    const start = match.index
    const end = start + url.length
    const before = segment.slice(0, start)
    const after = segment.slice(end)
    result += segment.slice(cursor, start)
    cursor = end
    switch (classifyUploadUrl(before, after)) {
      case 'leave':
        result += url
        break
      case 'origin':
        result += matchedPath
        break
      case 'autolink':
        // Replace the surrounding `<…>` too: `</uploads/…>` is not an autolink.
        result = result.slice(0, -1) + toMarkdownLink(matchedPath)
        cursor += 1
        break
      case 'bare': {
        // GFM autolinks a bare `https://` URL but not a bare path, so the
        // download would stop being clickable. Make the link explicit.
        const trailing = matchedPath.match(TRAILING_PUNCTUATION)?.[0] ?? ''
        const path = matchedPath.slice(0, matchedPath.length - trailing.length)
        result += toMarkdownLink(path) + trailing
      }
    }
  }
  return result + segment.slice(cursor)
}

/**
 * Reduce every absolute URL to our own upload path inside free text to the
 * site-relative path.
 *
 * The CKEditor plugin prefixes `window.strapi.backendURL` onto every image and
 * file it inserts, whether dragged, pasted or picked from the media library,
 * and has no option to stop it. Left in place, the link records whichever CMS
 * the editor happened to use (localhost included), loads from the firewalled
 * origin instead of the deployed copy, and reads as external to the image
 * optimizer, the image audit and the link validator.
 *
 * Where the URL sits decides what happens to it:
 * - a link or image destination, an HTML attribute or link text: only the
 *   origin is cut, and the rest is kept byte for
 *   byte (`new URL` would turn a Markdown-escaped `\_` into `/`);
 * - a bare URL or `<url>` autolink in prose: it becomes an explicit Markdown
 *   link, because GFM does not autolink a relative path;
 * - nested in another URL, or in a code span or fenced block: left alone.
 *
 * Matched by path, like `stripUploadOrigin`: if `STRAPI_UPLOADS_BASE_URL` ever
 * points uploads at a CDN, that origin is stripped too.
 */
export function stripUploadOriginsInText(text: string): string {
  return mapOutsideMarkdownCode(text, stripUploadOriginsInProse)
}

/**
 * Applies `rewrite` to the prose of a Markdown text and leaves fenced blocks
 * and inline code spans untouched: a URL in code is an example, not a link.
 */
export function mapOutsideMarkdownCode(
  text: string,
  rewrite: (prose: string) => string
): string {
  return text
    .split(MARKDOWN_CODE)
    .map((segment, index) =>
      // `split` with a capture group puts the code at odd indices.
      index % 2 === 1 ? segment : rewrite(segment)
    )
    .join('')
}

/** An inline Markdown link to a site path: `](/path)`, not `](//host)`. */
const INTERNAL_MARKDOWN_LINK = /\]\((\/(?!\/)[^)\s]*)\)/g

/**
 * Gives every internal Markdown link in a text the stored `/path/` form
 * (INTORG-1254), outside code. File links (`/uploads/…/report.pdf`, images)
 * keep their form, as in {@link toSlashedPath}.
 */
export function slashInternalMarkdownLinks(text: string): string {
  return mapOutsideMarkdownCode(text, (prose) =>
    prose.replace(
      INTERNAL_MARKDOWN_LINK,
      (_link, path: string) => `](${toSlashedPath(path)})`
    )
  )
}

/**
 * The key two slugs are compared by: `about`, `/about` and `/about/` are one
 * page. Stored slugs move from the bare form to `/about/` (INTORG-1254), and
 * until every row and file has moved, both forms exist side by side.
 */
export function bareSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '')
}

export function isSameSlug(a: string, b: string): boolean {
  return bareSlug(a) === bareSlug(b)
}

/**
 * Every stored form of a slug, for an exact-match database filter
 * (`{ pathSlug: { $in: slugVariants(slug) } }`). The save hook only ever wrote
 * the bare form or `/slug/`, so those two are all a row can hold.
 */
export function slugVariants(value: string): string[] {
  const bare = bareSlug(value)
  return [bare, `/${bare}/`]
}

/**
 * The stored form of a slug: `about`, `/about` and `about/` all become
 * `/about/`, so editors meet one convention on every field (INTORG-1254).
 * An empty value stays empty for the `required` validator to report.
 */
export function toSlashedSlug(value: string): string {
  const bare = bareSlug(value)
  return bare ? `/${bare}/` : ''
}

/** The query or fragment that follows a path: `?tab=1`, `#team`. */
const PATH_SUFFIX = /[?#]/

/** A last path segment that names a file, e.g. `report.pdf`. */
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/

/**
 * The stored form of an internal link: a leading and a trailing slash, as the
 * site serves it (`/grant/our-grantmaking/`). The trailing slash goes before
 * any query or fragment (`/blog/?tag=x`, `/about/#team`).
 *
 * Left alone: external URLs, `mailto:`/`tel:`, a bare `#id` (a same-page
 * anchor, or a Fundraise Up element id on the donation card), and a link to a
 * file (`/uploads/…/report.pdf`), which a trailing slash would break.
 */
export function toSlashedPath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || ABSOLUTE_OR_SPECIAL_HREF.test(trimmed)) return value

  const suffixStart = trimmed.search(PATH_SUFFIX)
  const path = suffixStart === -1 ? trimmed : trimmed.slice(0, suffixStart)
  const suffix = suffixStart === -1 ? '' : trimmed.slice(suffixStart)

  const segments = path.split('/').filter(Boolean)
  const joined = `/${segments.join('/')}`
  const lastSegment = segments.at(-1) ?? ''
  if (FILE_EXTENSION.test(lastSegment)) return `${joined}${suffix}`
  return `${addTrailingSlash(joined)}${suffix}`
}

function addTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
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
        ;(data as Record<string, unknown>)[key] = toSlashedPath(
          stripUploadOrigin(value)
        )
      } else if (SINGLE_URL_FIELDS.has(key)) {
        ;(data as Record<string, unknown>)[key] = stripUploadOrigin(value)
      } else if (PATH_SEGMENT_FIELDS.has(key)) {
        ;(data as Record<string, unknown>)[key] = toSlashedSlug(value)
      } else if (!CODE_FIELDS.has(key)) {
        // Every other string, so each CKEditor field is covered wherever it
        // sits (components, dynamic zones) without a field list to drift.
        ;(data as Record<string, unknown>)[key] = slashInternalMarkdownLinks(
          stripUploadOriginsInText(value)
        )
      }
    } else {
      normalizeRelativeLinksInDocumentData(value)
    }
  }
}
