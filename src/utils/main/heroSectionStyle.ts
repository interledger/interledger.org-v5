import { encodeImageUrlPath, getOptimizedImage } from './images'

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
  const url = fullSrc ?? encodeImageUrlPath(trimmed)
  const layers = [`url('${url}')`]
  const blur = heroImageBlur?.trim()
  if (blur) layers.push(`url('${blur}')`)

  return { backgroundImage: layers.join(', ') }
}
