import {
  getOptimizedImage,
  hasOptimizedVariants,
  TARGET_WIDTHS
} from './images'

interface HomepageHeroAlternateSource {
  src: string
  media: string
  sizes: string
  widths?: readonly number[]
  intrinsicWidth?: number
}

/** Intrinsic dimensions of homepage hero raster (CLS / decode hint). Mirrors `stefan-thomas.webp`. */
export const HERO_LCP_IMAGE_WIDTH = 1920
export const HERO_LCP_IMAGE_HEIGHT = 1280
export const HERO_STANDARD_SRC = '/img/homepage/stefan-thomas.webp'
export const HERO_HIGHRES_SRC = '/img/homepage/stefan-thomas-highres.avif'
/**
 * Intrinsic width of `stefan-thomas-highres.avif`. Caps its ladder so the 3840
 * rung stops re-encoding the source into something larger than the file itself;
 * at this width the AVIF source is served directly. Update alongside the asset.
 */
export const HERO_HIGHRES_INTRINSIC_WIDTH = 3463
/** QHD / 4K TVs and very large desktop displays. */
export const HERO_TV_MIN_WIDTH = 2560
export const HOMEPAGE_HERO_TABLET_MIN = 810
/**
 * `PageHero`'s mobile/desktop split. Shared by `PageHero.astro` (the real
 * `<picture>` `media` gating) and `heroLcpPreload.ts` (the matching `<link
 * rel="preload">`) so the two can't drift onto different breakpoints.
 */
export const PAGE_HERO_MOBILE_MEDIA = `(max-width: ${HOMEPAGE_HERO_TABLET_MIN - 1}px)`
export const PAGE_HERO_DESKTOP_MEDIA = `(min-width: ${HOMEPAGE_HERO_TABLET_MIN}px)`

export interface HomepageHeroPictureConfig {
  primarySrc: string
  heroSizes: string
  heroMedia: string
  alternateSources: HomepageHeroAlternateSource[] | undefined
}

/** Shared by HomepageHero and LCP preload — keep picture + preload in sync. */
export function getHomepageHeroPictureConfig(): HomepageHeroPictureConfig {
  const heroSizes = '100vw'
  const useHighRes = hasOptimizedVariants(
    getOptimizedImage(HERO_HIGHRES_SRC, TARGET_WIDTHS)
  )
  const heroMedia = useHighRes
    ? `(min-width: ${HOMEPAGE_HERO_TABLET_MIN}px) and (max-width: ${HERO_TV_MIN_WIDTH - 1}px)`
    : `(min-width: ${HOMEPAGE_HERO_TABLET_MIN}px)`
  const alternateSources = useHighRes
    ? [
        {
          src: HERO_HIGHRES_SRC,
          media: `(min-width: ${HERO_TV_MIN_WIDTH}px)`,
          sizes: heroSizes,
          widths: TARGET_WIDTHS,
          intrinsicWidth: HERO_HIGHRES_INTRINSIC_WIDTH
        }
      ]
    : undefined

  return {
    primarySrc: HERO_STANDARD_SRC,
    heroSizes,
    heroMedia,
    alternateSources
  }
}
