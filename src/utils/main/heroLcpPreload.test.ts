import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  buildImageSrcset,
  getOptimizedImage,
  setDeployedImageSourcesForTests,
  setImageCdnEnabledForTests
} from './images'
import {
  getHomepageHeroPictureConfig,
  HOMEPAGE_HERO_TABLET_MIN
} from './homepageHeroImage'
import {
  getHomepageHeroPreloadLinks,
  getPageHeroPreloadLinks,
  resolveHeroLcpPreloadLinks
} from './heroLcpPreload'

describe('getHomepageHeroPreloadLinks', () => {
  beforeEach(() => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests([
      '/img/homepage/stefan-thomas.webp',
      '/img/homepage/stefan-thomas-highres.avif'
    ])
  })

  afterEach(() => {
    setImageCdnEnabledForTests(null)
    setDeployedImageSourcesForTests(null)
  })

  it('matches the AVIF srcset HomepageHero will request for the primary source', () => {
    const { primarySrc, heroSizes, heroMedia } = getHomepageHeroPictureConfig()
    const expectedSrcset = buildImageSrcset(
      getOptimizedImage(primarySrc).avifVariants
    )
    const [primary] = getHomepageHeroPreloadLinks()

    expect(primary).toMatchObject({
      imageSizes: heroSizes,
      media: heroMedia,
      type: 'image/avif',
      imageSrcset: expectedSrcset
    })
  })
})

describe('getPageHeroPreloadLinks', () => {
  beforeEach(() => {
    setImageCdnEnabledForTests(true)
  })

  afterEach(() => {
    setImageCdnEnabledForTests(null)
    setDeployedImageSourcesForTests(null)
  })

  it('returns separate mobile and desktop preloads when both images are set', () => {
    setDeployedImageSourcesForTests([
      '/img/grant/hero-desktop.webp',
      '/img/grant/hero-mobile.webp'
    ])

    const links = getPageHeroPreloadLinks({
      image: '/img/grant/hero-desktop.webp',
      imageMobile: '/img/grant/hero-mobile.webp'
    })

    expect(links).toHaveLength(2)
    expect(links[0]?.media).toBe(
      `(max-width: ${HOMEPAGE_HERO_TABLET_MIN - 1}px)`
    )
    expect(links[1]?.media).toBe(`(min-width: ${HOMEPAGE_HERO_TABLET_MIN}px)`)
  })

  it('returns a single preload for a desktop-only hero image', () => {
    setDeployedImageSourcesForTests(['/img/grant/hero-desktop.webp'])

    const links = getPageHeroPreloadLinks({
      image: '/img/grant/hero-desktop.webp'
    })

    expect(links).toHaveLength(1)
    expect(links[0]?.media).toBeUndefined()
  })

  it('returns nothing when no hero images are provided', () => {
    expect(getPageHeroPreloadLinks({})).toEqual([])
  })
})

describe('resolveHeroLcpPreloadLinks', () => {
  it('delegates homepage config to getHomepageHeroPreloadLinks', () => {
    expect(resolveHeroLcpPreloadLinks('homepage')).toEqual(
      getHomepageHeroPreloadLinks()
    )
  })
})
