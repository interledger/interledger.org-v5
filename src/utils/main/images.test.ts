import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import {
  getOptimizedImage,
  hasOptimizedVariants,
  isOptimizableSource,
  setDeployedImageSourcesForTests,
  setImageCdnEnabledForTests,
  setOptimizedImageVariantCatalogForTests,
  withIntrinsicWidthRung
} from './images'
import {
  buildImageCdnUrl,
  largestTargetWidth,
  NETLIFY_IMAGE_ENDPOINT
} from './imageCdn'
import { DEFAULT_CDN_WIDTHS, TARGET_WIDTHS } from './imagePaths'

const EMPTY = {
  variants: [],
  fullSrc: null,
  avifVariants: [],
  avifFullSrc: null
}

function readCdnSourceParam(cdnUrl: string): string | null {
  return new URL(cdnUrl, 'https://example.com').searchParams.get('url')
}

afterEach(() => {
  setOptimizedImageVariantCatalogForTests(null)
  setDeployedImageSourcesForTests(null)
  setImageCdnEnabledForTests(null)
  vi.restoreAllMocks()
})

describe('getOptimizedImage', () => {
  it('returns WebP/AVIF variants from the catalog without reading public/', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync')

    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/example-640.webp',
      '/img/optimized/example-1280.webp',
      '/img/optimized/example-full.webp',
      '/img/optimized/example-640.avif',
      '/img/optimized/example-1280.avif',
      '/img/optimized/example-full.avif'
    ])

    const result = getOptimizedImage('/img/example.png')

    expect(result).toEqual({
      variants: [
        { src: '/img/optimized/example-640.webp', width: 640 },
        { src: '/img/optimized/example-1280.webp', width: 1280 }
      ],
      fullSrc: '/img/optimized/example-full.webp',
      avifVariants: [
        { src: '/img/optimized/example-640.avif', width: 640 },
        { src: '/img/optimized/example-1280.avif', width: 1280 }
      ],
      avifFullSrc: '/img/optimized/example-full.avif'
    })
    expect(existsSpy).not.toHaveBeenCalled()
  })

  it('includes exact intrinsic-width variants from the catalog (INTORG-934)', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-640.webp',
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-1200.webp',
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-full.webp',
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-640.avif',
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-1200.avif',
      '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-full.avif'
    ])

    expect(
      getOptimizedImage(
        '/img/foundation-blog/2026-06-02/www-presentation-1.webp'
      )
    ).toEqual({
      variants: [
        {
          src: '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-640.webp',
          width: 640
        },
        {
          src: '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-1200.webp',
          width: 1200
        }
      ],
      fullSrc:
        '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-full.webp',
      avifVariants: [
        {
          src: '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-640.avif',
          width: 640
        },
        {
          src: '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-1200.avif',
          width: 1200
        }
      ],
      avifFullSrc:
        '/img/optimized/foundation-blog/2026-06-02/www-presentation-1-full.avif'
    })
  })

  it('maps upload originals to /img/optimized/uploads variants', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/uploads/hero-640.webp',
      '/img/optimized/uploads/hero-full.webp',
      '/img/optimized/uploads/hero-full.avif'
    ])

    const result = getOptimizedImage('/uploads/img/original/hero.jpg')

    expect(result.variants).toEqual([
      { src: '/img/optimized/uploads/hero-640.webp', width: 640 }
    ])
    expect(result.fullSrc).toBe('/img/optimized/uploads/hero-full.webp')
    expect(result.avifFullSrc).toBe('/img/optimized/uploads/hero-full.avif')
    expect(result.avifVariants).toEqual([])
  })

  it('returns empty data when the catalog has no matching variants', () => {
    setOptimizedImageVariantCatalogForTests([])

    expect(getOptimizedImage('/img/missing.png')).toEqual({
      variants: [],
      fullSrc: null,
      avifVariants: [],
      avifFullSrc: null
    })
  })

  it('returns empty data for SVGs and unrecognized paths', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/logo-full.webp'])

    expect(getOptimizedImage('/img/logo.svg')).toEqual({
      variants: [],
      fullSrc: null,
      avifVariants: [],
      avifFullSrc: null
    })
    expect(getOptimizedImage('/somewhere/else.png')).toEqual({
      variants: [],
      fullSrc: null,
      avifVariants: [],
      avifFullSrc: null
    })
  })

  it('only populates fullSrc when no sized responsive variants exist', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/hero-full.webp'])

    expect(getOptimizedImage('/img/hero.png')).toEqual({
      variants: [],
      fullSrc: '/img/optimized/hero-full.webp',
      avifVariants: [],
      avifFullSrc: null
    })
  })
})

describe('getOptimizedImage — Netlify Image CDN mode', () => {
  // Every source is gated on the deployed-image-sources catalog in CDN mode, so
  // the sources these tests exercise must be present unless a test overrides it.
  beforeEach(() => {
    setDeployedImageSourcesForTests([
      '/img/hero.png',
      '/uploads/img/original/hero.jpg'
    ])
  })

  it('returns CDN URLs for the default width ladder, ignoring the catalog', () => {
    // Empty catalog: when the CDN is on the encoder never runs, so the runtime
    // catalog falls back to its committed (empty) stub.
    setOptimizedImageVariantCatalogForTests([])
    setImageCdnEnabledForTests(true)

    const result = getOptimizedImage('/img/hero.png')

    expect(result.variants.map((v) => v.width)).toEqual([...DEFAULT_CDN_WIDTHS])
    expect(result.variants[0].src).toBe(
      buildImageCdnUrl('/img/hero.png', { format: 'webp', width: 640 })
    )
    expect(result.avifVariants.map((v) => v.width)).toEqual([
      ...DEFAULT_CDN_WIDTHS
    ])
    expect(result.avifVariants[0].src).toBe(
      buildImageCdnUrl('/img/hero.png', { format: 'avif', width: 640 })
    )
  })

  it('caps the default ladder below the full target widths', () => {
    // Guards the billing win: ordinary images must not advertise 2560/3840,
    // which would be extra billed transforms of clamped, identical output.
    setImageCdnEnabledForTests(true)

    const widths = getOptimizedImage('/img/hero.png').variants.map(
      (v) => v.width
    )

    expect(widths).not.toContain(2560)
    expect(widths).not.toContain(3840)
    expect(widths.length).toBeLessThan(TARGET_WIDTHS.length)
  })

  it('offers the full ladder when a caller opts in (the 4K hero)', () => {
    setImageCdnEnabledForTests(true)

    const result = getOptimizedImage('/img/hero.png', TARGET_WIDTHS)

    expect(result.variants.map((v) => v.width)).toEqual([...TARGET_WIDTHS])
    expect(result.avifVariants.map((v) => v.width)).toEqual([...TARGET_WIDTHS])
    expect(result.fullSrc).toContain(`w=${largestTargetWidth()}`)
  })

  it('points fullSrc at the widest transform rather than an unsized URL', () => {
    // An unsized URL renders the same pixels but is a separate cache entry,
    // so it would be a second billed transform for the same image.
    setImageCdnEnabledForTests(true)

    const { fullSrc, avifFullSrc, variants } =
      getOptimizedImage('/img/hero.png')

    expect(fullSrc).toBe(
      buildImageCdnUrl('/img/hero.png', {
        format: 'webp',
        width: largestTargetWidth(DEFAULT_CDN_WIDTHS)
      })
    )
    expect(fullSrc).toBe(variants.at(-1)?.src)
    expect(avifFullSrc).toContain(`w=${largestTargetWidth(DEFAULT_CDN_WIDTHS)}`)
  })

  it('never emits an unsized transform', () => {
    setImageCdnEnabledForTests(true)

    const image = getOptimizedImage('/img/hero.png')
    const urls = [
      ...image.variants.map((v) => v.src),
      ...image.avifVariants.map((v) => v.src),
      image.fullSrc,
      image.avifFullSrc
    ].filter((src): src is string => src !== null)

    for (const src of urls) expect(src).toMatch(/[?&]w=\d+/)
  })

  it('emits same-origin CDN sources for deployed relative uploads', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests(['/uploads/img/original/hero.jpg'])

    const { fullSrc } = getOptimizedImage('/uploads/img/original/hero.jpg')

    expect(fullSrc).toContain(
      encodeURIComponent('/uploads/img/original/hero.jpg')
    )
    expect(fullSrc).not.toContain('optimized')
    expect(readCdnSourceParam(fullSrc!)).toBe('/uploads/img/original/hero.jpg')
  })

  it('normalizes absolute Strapi upload URLs to same-origin CDN sources', () => {
    // The CMS is firewalled and the site must stay self-contained, so an
    // absolute CMS origin must never reach the browser as a CDN source.
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests(['/uploads/img/original/hero.jpg'])

    const absolute = 'https://cms.example.com/uploads/img/original/hero.jpg'
    const { variants } = getOptimizedImage(absolute)

    expect(variants[0].src).toBe(
      buildImageCdnUrl('/uploads/img/original/hero.jpg', {
        format: 'webp',
        width: 640
      })
    )
    expect(readCdnSourceParam(variants[0].src)).toBe(
      '/uploads/img/original/hero.jpg'
    )
    expect(variants[0].src).not.toContain('cms.example.com')
  })

  it('degrades uploads missing from this deploy to no variants', () => {
    // CDN mode has no encoder catalog; an upload not yet git-synced from the
    // firewalled CMS must not get a 404ing <picture> source, so it returns
    // empty and the component falls back to a plain <img>.
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests([])

    expect(getOptimizedImage('/uploads/img/original/missing.jpg')).toEqual(
      EMPTY
    )
  })

  it('keeps /img sources relative in CDN mode', () => {
    setImageCdnEnabledForTests(true)

    const src = '/img/hero.png'
    const { fullSrc } = getOptimizedImage(src)

    expect(readCdnSourceParam(fullSrc!)).toBe(src)
  })

  it('still emits CDN URLs for stable /img sources', () => {
    setImageCdnEnabledForTests(true)

    expect(getOptimizedImage('/img/hero.png').variants[0]?.src).toBe(
      buildImageCdnUrl('/img/hero.png', {
        format: 'webp',
        width: 640
      })
    )
  })

  it('still refuses SVGs and unrecognized paths', () => {
    setImageCdnEnabledForTests(true)

    for (const src of ['/img/logo.svg', '/somewhere/else.png', '/img/noext']) {
      expect(getOptimizedImage(src)).toEqual(EMPTY)
    }
  })

  it('refuses GIFs so animation is preserved (served as-is)', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests(['/img/foundation-blog/anim.gif'])

    expect(getOptimizedImage('/img/foundation-blog/anim.gif')).toEqual(EMPTY)
  })

  it('does not re-transform an already-optimized path', () => {
    setImageCdnEnabledForTests(true)

    expect(getOptimizedImage('/img/optimized/hero-640.webp')).toEqual(EMPTY)
  })

  it('reports variants as available so components render a <picture>', () => {
    setImageCdnEnabledForTests(true)

    expect(hasOptimizedVariants(getOptimizedImage('/img/hero.png'))).toBe(true)
  })

  it('reports no variants for an /img source missing from this deploy', () => {
    // Guards the HomepageHero probe: hasOptimizedVariants is a real existence
    // check, not a constant. A renamed/removed highres source must report false
    // so the hero falls back instead of emitting a 404ing >=2560px <source>.
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests(['/img/homepage/stefan-thomas.webp'])

    const highRes = getOptimizedImage(
      '/img/homepage/stefan-thomas-highres.avif',
      TARGET_WIDTHS
    )

    expect(highRes).toEqual(EMPTY)
    expect(hasOptimizedVariants(highRes)).toBe(false)
  })

  it('falls back to the catalog when the CDN is off', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/hero-640.webp'])
    setImageCdnEnabledForTests(false)

    expect(getOptimizedImage('/img/hero.png').variants).toEqual([
      { src: '/img/optimized/hero-640.webp', width: 640 }
    ])
  })
})

describe('withIntrinsicWidthRung', () => {
  const HERO = '/img/homepage/stefan-thomas-highres.avif'
  const HERO_WIDTH = 3463

  beforeEach(() => {
    setDeployedImageSourcesForTests([HERO, '/img/master.png'])
  })

  function heroLadder(src = HERO) {
    setImageCdnEnabledForTests(true)
    return withIntrinsicWidthRung(
      getOptimizedImage(src, TARGET_WIDTHS),
      src,
      HERO_WIDTH
    )
  }

  it('serves an AVIF source directly at its intrinsic width', () => {
    const { avifVariants, avifFullSrc } = heroLadder()

    expect(avifVariants.at(-1)).toEqual({ src: HERO, width: HERO_WIDTH })
    expect(avifFullSrc).toBe(HERO)
  })

  it('drops the rungs that would clamp to the intrinsic width', () => {
    // 2560 is a genuine downscale and stays; 3840 clamped to 3463 and came back
    // larger than the source file, so it collapses into the intrinsic rung.
    const { avifVariants } = heroLadder()

    expect(avifVariants.map((v) => v.width)).toEqual([
      640,
      1280,
      1920,
      2560,
      HERO_WIDTH
    ])
    expect(
      avifVariants.filter(
        (v) => v.width >= HERO_WIDTH && v.src.includes(NETLIFY_IMAGE_ENDPOINT)
      )
    ).toEqual([])
  })

  it('uses an exact-width transform when the source format differs', () => {
    // No raw WebP exists at this resolution, so the WebP <source> still needs a
    // transform — but at the intrinsic width, not a clamped 3840.
    const { variants, fullSrc } = heroLadder()
    const expected = buildImageCdnUrl(HERO, {
      format: 'webp',
      width: HERO_WIDTH
    })

    expect(variants.at(-1)).toEqual({ src: expected, width: HERO_WIDTH })
    expect(fullSrc).toBe(expected)
  })

  it('transforms both formats when the source is neither AVIF nor WebP', () => {
    const src = '/img/master.png'
    setImageCdnEnabledForTests(true)
    const { variants, avifVariants } = withIntrinsicWidthRung(
      getOptimizedImage(src, TARGET_WIDTHS),
      src,
      2000
    )

    expect(variants.at(-1)?.src).toBe(
      buildImageCdnUrl(src, { format: 'webp', width: 2000 })
    )
    expect(avifVariants.at(-1)?.src).toBe(
      buildImageCdnUrl(src, { format: 'avif', width: 2000 })
    )
  })

  it('leaves a source missing from this deploy degraded', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests([])

    const src = '/img/homepage/renamed.avif'

    expect(
      withIntrinsicWidthRung(getOptimizedImage(src, TARGET_WIDTHS), src, 3463)
    ).toEqual(EMPTY)
  })

  it('no-ops when the CDN is off — the encoder already emits exact widths', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/homepage/stefan-thomas-highres-640.avif',
      '/img/optimized/homepage/stefan-thomas-highres-3463.avif'
    ])
    setImageCdnEnabledForTests(false)

    const encoded = getOptimizedImage(HERO, TARGET_WIDTHS)

    expect(withIntrinsicWidthRung(encoded, HERO, HERO_WIDTH)).toBe(encoded)
  })
})

describe('isOptimizableSource', () => {
  it('accepts optimizable rasters, rejects svgs and unknown paths', () => {
    expect(isOptimizableSource('/img/hero.png')).toBe(true)
    expect(isOptimizableSource('/uploads/img/original/x.jpg')).toBe(true)
    expect(
      isOptimizableSource('https://cms.example.com/uploads/img/original/x.jpg')
    ).toBe(true)
    expect(isOptimizableSource('/img/logo.svg')).toBe(false)
    expect(isOptimizableSource('/img/foundation-blog/anim.gif')).toBe(false)
    expect(isOptimizableSource('/somewhere/else.png')).toBe(false)
    expect(isOptimizableSource('/img/noext')).toBe(false)
  })

  it('rejects extensions the encoder never produces variants for', () => {
    // A .tiff is a valid Strapi upload but is skipped by the encoder, so it
    // never lands in the deployed-sources catalog. Treating it as optimizable
    // made a perfectly deliverable image render as a "missing source" degrade.
    expect(isOptimizableSource('/uploads/img/original/scan.tiff')).toBe(false)
    expect(isOptimizableSource('/img/old.bmp')).toBe(false)
  })

  it('reads the extension from the pathname, not the query string', () => {
    expect(
      isOptimizableSource(
        'https://cms.example.com/uploads/img/original/logo.svg?updated=1'
      )
    ).toBe(false)
    expect(isOptimizableSource('/img/hero.png?v=2')).toBe(true)
  })
})
