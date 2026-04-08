export function getHeroSectionStyle(
  heroImage?: string
): Record<string, string> | undefined {
  const safeHeroImageUrl = heroImage?.trim()
    ? encodeURI(heroImage.trim())
    : undefined

  return safeHeroImageUrl
    ? {
        backgroundImage: `url('${safeHeroImageUrl}')`
      }
    : undefined
}
