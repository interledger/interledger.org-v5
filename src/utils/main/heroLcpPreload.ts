import {
  buildImageSrcset,
  resolveOptimizedImage,
  type OptimizedImage
} from './images'
import {
  getHomepageHeroPictureConfig,
  PAGE_HERO_MOBILE_MEDIA,
  PAGE_HERO_DESKTOP_MEDIA
} from './homepageHeroImage'

export interface ImagePreloadLink {
  href: string
  imageSrcset: string
  imageSizes: string
  type: 'image/avif'
  media?: string
}

export interface PageHeroPreloadOptions {
  image?: string | null
  imageMobile?: string | null
}

/** Passed to FoundationPageLayout / HeroImagePreload — one entry point for LCP preloads. */
export type HeroLcpPreloadConfig = 'homepage' | PageHeroPreloadOptions

export function resolveHeroLcpPreloadLinks(
  config: HeroLcpPreloadConfig
): ImagePreloadLink[] {
  if (config === 'homepage') return getHomepageHeroPreloadLinks()
  return getPageHeroPreloadLinks(config)
}

function toAvifPreloadLink(
  image: OptimizedImage,
  sizes: string,
  media?: string
): ImagePreloadLink | null {
  const imageSrcset =
    image.avifVariants.length > 0
      ? buildImageSrcset(image.avifVariants)
      : image.avifFullSrc
  const href =
    image.avifVariants[image.avifVariants.length - 1]?.src ?? image.avifFullSrc
  if (!imageSrcset || !href) return null

  return {
    href,
    imageSrcset,
    imageSizes: sizes,
    type: 'image/avif',
    media
  }
}

function preloadLinkForSource(
  src: string,
  sizes: string,
  media?: string,
  widths?: readonly number[],
  intrinsicWidth?: number
): ImagePreloadLink | null {
  return toAvifPreloadLink(
    resolveOptimizedImage(src, widths, intrinsicWidth),
    sizes,
    media
  )
}

/** Preload candidates for the homepage Stefan hero (tablet+ only). */
export function getHomepageHeroPreloadLinks(): ImagePreloadLink[] {
  const { primarySrc, heroSizes, heroMedia, alternateSources } =
    getHomepageHeroPictureConfig()
  const links: ImagePreloadLink[] = []

  const primary = preloadLinkForSource(primarySrc, heroSizes, heroMedia)
  if (primary) links.push(primary)

  for (const alternate of alternateSources ?? []) {
    const link = preloadLinkForSource(
      alternate.src,
      alternate.sizes,
      alternate.media,
      alternate.widths,
      alternate.intrinsicWidth
    )
    if (link) links.push(link)
  }

  return links
}

/** Preload candidates for PageHero image band (matches mobile/desktop CSS split). */
export function getPageHeroPreloadLinks(options: {
  image?: string | null
  imageMobile?: string | null
}): ImagePreloadLink[] {
  const sizes = '100vw'
  const links: ImagePreloadLink[] = []

  if (options.imageMobile?.trim()) {
    const mobile = preloadLinkForSource(
      options.imageMobile.trim(),
      sizes,
      PAGE_HERO_MOBILE_MEDIA
    )
    if (mobile) links.push(mobile)

    const desktopSrc = options.image?.trim() || options.imageMobile.trim()
    const desktop = preloadLinkForSource(
      desktopSrc,
      sizes,
      PAGE_HERO_DESKTOP_MEDIA
    )
    if (desktop) links.push(desktop)
    return links
  }

  if (options.image?.trim()) {
    const link = preloadLinkForSource(options.image.trim(), sizes)
    if (link) links.push(link)
  }

  return links
}
