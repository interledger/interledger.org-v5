import { getOptimizedImage } from './images'

export function getHeroSectionStyle(
  heroImage?: string
): Record<string, string> | undefined {
  const trimmed = heroImage?.trim()
  if (!trimmed) return undefined

  const { fullSrc } = getOptimizedImage(trimmed)
  const url = encodeURI(fullSrc ?? trimmed)

  return { backgroundImage: `url('${url}')` }
}
