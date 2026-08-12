import { getOptimizedImage } from './images'

export function getHeroSectionStyle(
  heroImage?: string
): Record<string, string> | undefined {
  const trimmed = heroImage?.trim()
  if (!trimmed) return undefined

  const { fullSrc } = getOptimizedImage(trimmed)
  const url = fullSrc ?? encodeURI(trimmed)

  return { backgroundImage: `url('${url}')` }
}
