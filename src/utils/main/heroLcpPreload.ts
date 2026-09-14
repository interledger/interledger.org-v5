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
  /**
   * `sizes` the desktop image advertises, when it isn't full-bleed. Must match
   * the `sizes` on the rendering `<OptimizedImage>`: advertise a wider slot
   * here and the browser preloads a bigger srcset candidate than the one the
   * `<picture>` then picks, so it downloads two images and the LCP one wasn't
   * preloaded at all. `PageHero`'s band spans the viewport, hence the `100vw`
   * default; `HackathonHero`'s sits in a half-width grid column from tablet up.
   */
  desktopSizes?: string
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

/** A mobile hero is full-bleed in every layout that renders one. */
const MOBILE_HERO_SIZES = '100vw'

/** Preload candidates for PageHero image band (matches mobile/desktop CSS split). */
export function getPageHeroPreloadLinks(
  options: PageHeroPreloadOptions
): ImagePreloadLink[] {
  const desktopSizes = options.desktopSizes ?? '100vw'
  const links: ImagePreloadLink[] = []

  if (options.imageMobile?.trim()) {
    const mobile = preloadLinkForSource(
      options.imageMobile.trim(),
      MOBILE_HERO_SIZES,
      PAGE_HERO_MOBILE_MEDIA
    )
    if (mobile) links.push(mobile)

    const desktopSrc = options.image?.trim() || options.imageMobile.trim()
    const desktop = preloadLinkForSource(
      desktopSrc,
      desktopSizes,
      PAGE_HERO_DESKTOP_MEDIA
    )
    if (desktop) links.push(desktop)
    return links
  }

  if (options.image?.trim()) {
    const link = preloadLinkForSource(options.image.trim(), desktopSizes)
    if (link) links.push(link)
  }

  return links
}
