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
}

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
      : {}
  }
}
