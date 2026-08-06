export function stripTrailingSlash(path: string): string {
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
}

export function addTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}

/** Prepends `/` to an internal path if it doesn't already have one. */
export function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

// Matches a URI scheme (`https:`, `mailto:`, `tel:`, …) or protocol-relative `//`
const HAS_SCHEME = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

/**
 * True when `url` already carries a scheme (`https:`, `mailto:`, `tel:`, …)
 * or is protocol-relative (`//host`). Use before {@link ensureLeadingSlash}
 * so scheme URLs are not turned into `/mailto:…` / `/https://…`.
 */
export function hasUrlScheme(url: string): boolean {
  return HAS_SCHEME.test(url.trim())
}

/**
 * Ensures an external URL is absolute. Bare hosts like `example.com` get
 * `https://` prepended; anything that already carries a scheme or is
 * protocol-relative is returned untouched. Empty input is returned as-is.
 */
export function ensureAbsoluteUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  return hasUrlScheme(trimmed) ? trimmed : `https://${trimmed}`
}

export type SocialIconName =
  | 'youtube'
  | 'slack'
  | 'github'
  | 'x'
  | 'mastodon'
  | 'linkedin'
  | 'instagram'

/** Generic icon used when a URL matches no known social platform. */
export const FALLBACK_SOCIAL_ICON = 'link-rounded'

// Known hosts mapped to their social icon.
const ICON_BY_HOST: Record<string, SocialIconName> = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'slack.com': 'slack',
  'github.com': 'github',
  'twitter.com': 'x',
  'x.com': 'x',
  'linkedin.com': 'linkedin',
  'instagram.com': 'instagram'
}

// Schemes allowed in markdown/rich-text-rendered hrefs. A scheme-less href
// (relative path, `#anchor`, protocol-relative `//host`) is always safe —
// only an explicit, non-allowlisted scheme (`javascript:`, `data:`,
// `vbscript:`, `file:`, ...) is rejected.
const SAFE_MARKDOWN_HREF_SCHEMES = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:'
])
const HREF_SCHEME = /^([a-z][a-z\d+\-.]*):/i

// Per the WHATWG URL spec, tab/newline/carriage-return are stripped from a
// URL wherever they appear before the scheme is parsed — so a browser reads
// `java\tscript:alert(1)` as `javascript:alert(1)`. Strip the same
// characters (plus other C0 controls, to be safe) before scheme detection,
// so an obfuscated scheme can't slip past `HREF_SCHEME` as "no scheme".
// eslint-disable-next-line no-control-regex -- intentionally matching C0 controls to strip them, not a typo
const SCHEME_OBFUSCATION_CHARS = /[\x00-\x1f\x7f]+/g

/**
 * Whether an href is safe to render as a markdown/rich-text link's `href`.
 * Used to neutralize editor-supplied markdown links (e.g. `[x](javascript:...)`)
 * that would otherwise pass through a markdown renderer's link output
 * untouched — renderers typically HTML-escape the href but don't restrict
 * its scheme.
 */
export function isSafeMarkdownHref(href: string): boolean {
  const trimmed = href.trim()
  const schemeProbe = trimmed.replace(SCHEME_OBFUSCATION_CHARS, '')
  const match = HREF_SCHEME.exec(schemeProbe)
  if (!match) return true
  return SAFE_MARKDOWN_HREF_SCHEMES.has(`${match[1].toLowerCase()}:`)
}

/** The host of `url`, lowercased, or null if it can't be parsed. */
function getHostname(url: string): string | null {
  try {
    return new URL(ensureAbsoluteUrl(url)).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Picks a social icon name for an external profile URL based on its host,
 * falling back to {@link FALLBACK_SOCIAL_ICON} when no platform matches or the
 * URL can't be parsed.
 */
export function getSocialIconName(
  url: string
): SocialIconName | typeof FALLBACK_SOCIAL_ICON {
  const host = getHostname(url)
  if (!host) return FALLBACK_SOCIAL_ICON

  for (const [knownHost, icon] of Object.entries(ICON_BY_HOST)) {
    if (host === knownHost || host.endsWith(`.${knownHost}`)) return icon
  }
  // Mastodon is federated, so there's no single host to match — instances run
  // on their own domains (mastodon.social, mastodon.world, …)
  if (host.includes('mastodon')) return 'mastodon'
  return FALLBACK_SOCIAL_ICON
}
