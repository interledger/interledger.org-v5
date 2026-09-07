import {
  encodeImageUrlPath,
  getOptimizedImage,
  sanitizeBlurPlaceholder
} from './images'

/**
 * Layers the real hero image over a base64 LQIP blur placeholder when one is
 * available (`heroImageBlur` frontmatter): the blur paints immediately since
 * it's inline data, and the real image opaquely replaces it the moment its
 * own bytes are fetched and decoded — pure CSS, no JS.
 */
export function getHeroSectionStyle(
  heroImage?: string,
  heroImageBlur?: string
): Record<string, string> | undefined {
  const trimmed = heroImage?.trim()
  if (!trimmed) return undefined

  const { fullSrc } = getOptimizedImage(trimmed)
  // `encodeImageUrlPath` encodes per path segment and is only correct for a
  // site-relative literal path — applied to an absolute URL it would mangle
  // the scheme/host and destroy any query string. `encodeURI` (which leaves
  // `?`/`#` untouched) is the right tool there, matching how the rest of this
  // module treats an absolute source (see `resolveOptimizableSource`).
  const url =
    fullSrc ??
    (trimmed.startsWith('http')
      ? encodeURI(trimmed).replaceAll("'", '%27')
      : encodeImageUrlPath(trimmed))
  const layers = [`url('${url}')`]
  const blur = sanitizeBlurPlaceholder(heroImageBlur)
  if (blur) layers.push(`url('${blur}')`)

  return { backgroundImage: layers.join(', ') }
}
