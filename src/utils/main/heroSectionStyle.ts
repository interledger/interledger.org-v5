import { getOptimizedImage } from './images'

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
  const url = fullSrc ?? encodeURI(trimmed)
  const layers = [`url('${url}')`]
  if (heroImageBlur) layers.push(`url('${heroImageBlur}')`)

  return { backgroundImage: layers.join(', ') }
}
