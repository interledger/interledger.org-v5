import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import {
  getOptimizedImage,
  hasOptimizedVariants,
  setImageCdnEnabledForTests,
  setOptimizedImageVariantCatalogForTests
} from './images'
import { buildImageCdnUrl, largestTargetWidth } from './imageCdn'
import { TARGET_WIDTHS } from './imagePaths'

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
  it('returns CDN URLs for every target width, ignoring the catalog', () => {
    // Empty catalog: when the CDN is on the encoder never runs, so the runtime
    // catalog falls back to its committed (empty) stub.
    setOptimizedImageVariantCatalogForTests([])
    setImageCdnEnabledForTests(true)

    const result = getOptimizedImage('/img/hero.png')

    expect(result.variants.map((v) => v.width)).toEqual([...TARGET_WIDTHS])
    expect(result.variants[0].src).toBe(
      buildImageCdnUrl('/img/hero.png', { format: 'webp', width: 640 })
    )
    expect(result.avifVariants.map((v) => v.width)).toEqual([...TARGET_WIDTHS])
    expect(result.avifVariants[0].src).toBe(
      buildImageCdnUrl('/img/hero.png', { format: 'avif', width: 640 })
    )
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
        width: largestTargetWidth()
      })
    )
    expect(fullSrc).toBe(variants.at(-1)?.src)
    expect(avifFullSrc).toContain(`w=${largestTargetWidth()}`)
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

  it('keeps relative upload originals as same-origin CDN sources', () => {
    setImageCdnEnabledForTests(true)

    const { fullSrc } = getOptimizedImage('/uploads/img/original/hero.jpg')

    expect(fullSrc).toContain(
      encodeURIComponent('/uploads/img/original/hero.jpg')
    )
    expect(fullSrc).not.toContain('optimized')
    expect(readCdnSourceParam(fullSrc!)).toBe('/uploads/img/original/hero.jpg')
  })

  it('keeps absolute Strapi upload URLs absolute in CDN mode', () => {
    setImageCdnEnabledForTests(true)

    const absolute = 'https://cms.example.com/uploads/img/original/hero.jpg'
    const { variants } = getOptimizedImage(absolute)

    expect(variants[0].src).toBe(
      buildImageCdnUrl(absolute, {
        format: 'webp',
        width: 640
      })
    )
    expect(variants[0].src).toContain(encodeURIComponent(absolute))
    expect(variants[0].src).not.toContain('url=%2Fuploads%2Fimg%2Foriginal')
    expect(readCdnSourceParam(variants[0].src)).toBe(absolute)
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

  it('does not re-transform an already-optimized path', () => {
    setImageCdnEnabledForTests(true)

    expect(getOptimizedImage('/img/optimized/hero-640.webp')).toEqual(EMPTY)
  })

  it('reports variants as available so components render a <picture>', () => {
    setImageCdnEnabledForTests(true)

    expect(hasOptimizedVariants(getOptimizedImage('/img/hero.png'))).toBe(true)
  })

  it('falls back to the catalog when the CDN is off', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/hero-640.webp'])
    setImageCdnEnabledForTests(false)

    expect(getOptimizedImage('/img/hero.png').variants).toEqual([
      { src: '/img/optimized/hero-640.webp', width: 640 }
    ])
  })
})
