/**
 * Shared resolution for a content-authored call-to-action link.
 *
 * Every CTA on the site is authored the same way: a URL plus optional
 * "external" and "document" flags. But each surface that renders one had
 * re-derived the href, the external flag, the target attributes and the
 * trailing icon inline, and they drifted (INTORG-938). This is the single
 * source of truth for that derivation.
 */
import { ensureLeadingSlash, hasUrlScheme, isExternalHref } from '../shared/url'

/**
 * Trailing icons a CTA can carry. Every member must stay assignable to
 * `Icon.astro`'s `name` prop.
 */
export type CtaIconName = 'download' | 'external-link' | 'arrow-right' | 'swap'

export interface CtaLinkInput {
  /** Raw URL as authored: a site path, or an absolute URL. */
  url: string
  /**
   * Author's explicit external flag. Absolute http(s) URLs are treated as
   * external whether or not this is set, so a partner link still opens in a
   * new tab when an editor forgets the checkbox.
   */
  external?: boolean
  /** Author's explicit "this link downloads a file" flag. */
  document?: boolean
  /**
   * Icon for a link that is neither external nor a document. Call sites
   * disagree today (navigation cards use `swap`, others show nothing), so it
   * stays a parameter rather than a baked-in default.
   */
  internalIcon?: CtaIconName | null
}

export interface ResolvedCtaLink {
  href: string
  external: boolean
  document: boolean
  /** Trailing icon, or null when this link kind carries none. */
  icon: CtaIconName | null
  /** Spread onto the anchor. Empty for links that stay in the same tab. */
  targetAttrs:
    | { target: '_blank'; rel: 'noopener noreferrer' }
    | Record<string, never>
  /**
   * Spread onto the anchor. Empty unless the link is a document.
   *
   * Cards render the CTA twice: a visible button, and an invisible overlay
   * anchor that makes the whole card clickable. Both need this, or the two
   * halves of one card behave differently (Jonathan, #483).
   */
  downloadAttrs: { download: string } | Record<string, never>
}

/**
 * Derive the filename a download should be saved under, e.g.
 * `/docs/guide.pdf` becomes `guide.pdf`. An empty string still turns the
 * `download` attribute on, and lets the URL supply the name.
 */
export function resolveDownloadName(href: string): string {
  try {
    const path = href.startsWith('http')
      ? new URL(href).pathname
      : (href.split('?')[0] ?? href)
    const base = path.split('/').filter(Boolean).pop()
    return base && base.includes('.') ? base : ''
  } catch {
    return ''
  }
}

/**
 * When the caller names an icon for internal links, every link kind resolves
 * to one, so `icon` is never null. This overload keeps call sites from
 * guarding against a null that cannot happen.
 */
export function resolveCtaLink(
  input: CtaLinkInput & { internalIcon: CtaIconName }
): ResolvedCtaLink & { icon: CtaIconName }
export function resolveCtaLink(input: CtaLinkInput): ResolvedCtaLink
export function resolveCtaLink({
  url,
  external: externalFlag = false,
  document: isDocument = false,
  internalIcon = null
}: CtaLinkInput): ResolvedCtaLink {
  const external = externalFlag || isExternalHref(url)

  // Guard on the scheme, not on `external`: an author may tick "external" on a
  // site-relative path, and `mailto:` / `tel:` links carry a scheme without
  // being http(s). Either way, prefixing a slash would break the href.
  const href = hasUrlScheme(url) ? url : ensureLeadingSlash(url)

  const icon: CtaIconName | null = isDocument
    ? 'download'
    : external
      ? 'external-link'
      : internalIcon

  return {
    href,
    external,
    document: isDocument,
    icon,
    targetAttrs: external
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {},
    downloadAttrs: isDocument ? { download: resolveDownloadName(href) } : {}
  }
}
