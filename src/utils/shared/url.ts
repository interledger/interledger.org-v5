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

// Matches a URI scheme (`https:`, `mailto:`, `tel:`, …)
const HAS_SCHEME = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

/**
 * Ensures an external URL is absolute. Bare hosts like `example.com` get
 * `https://` prepended; anything that already carries a scheme or is
 * protocol-relative is returned untouched. Empty input is returned as-is.
 */
export function ensureAbsoluteUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
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
