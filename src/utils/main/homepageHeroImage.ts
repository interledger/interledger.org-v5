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
 *
 * Range syntax (`width < N` / `width >= N`) avoids 1px gaps from pairing
 * `max-width: N-1` with `min-width: N` on fractional viewports.
 */
export const PAGE_HERO_MOBILE_MEDIA = `(width < ${HOMEPAGE_HERO_TABLET_MIN}px)`
export const PAGE_HERO_DESKTOP_MEDIA = `(width >= ${HOMEPAGE_HERO_TABLET_MIN}px)`

/** Homepage Stefan hero on tablet+ when no separate 4K source is deployed. */
export const HOMEPAGE_HERO_STANDARD_MEDIA = `(width >= ${HOMEPAGE_HERO_TABLET_MIN}px)`
/** Standard hero source: tablet through sub-4K viewports (complements high-res). */
export const HOMEPAGE_HERO_STANDARD_WITH_TV_CAP_MEDIA = `(width >= ${HOMEPAGE_HERO_TABLET_MIN}px) and (width < ${HERO_TV_MIN_WIDTH}px)`
/** 4K homepage hero source; complements `HOMEPAGE_HERO_STANDARD_WITH_TV_CAP_MEDIA`. */
export const HOMEPAGE_HERO_HIGHRES_MEDIA = `(width >= ${HERO_TV_MIN_WIDTH}px)`

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
    ? HOMEPAGE_HERO_STANDARD_WITH_TV_CAP_MEDIA
    : HOMEPAGE_HERO_STANDARD_MEDIA
  const alternateSources = useHighRes
    ? [
        {
          src: HERO_HIGHRES_SRC,
          media: HOMEPAGE_HERO_HIGHRES_MEDIA,
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
