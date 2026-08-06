import { getLargestVariant, getOptimizedImage } from './images'

export function getHeroSectionStyle(
  heroImage?: string
): Record<string, string> | undefined {
  const trimmed = heroImage?.trim()
  if (!trimmed) return undefined

  // A CSS background can't carry a srcset, so take the full-size render: the
  // widest WebP variant. AVIF is skipped because CSS has no format negotiation
  // short of image-set(), and WebP is the safer single choice.
  const largest = getLargestVariant(getOptimizedImage(trimmed).variants)
  const url = encodeURI(largest?.src ?? trimmed)

  return { backgroundImage: `url('${url}')` }
}
