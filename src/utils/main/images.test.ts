import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import {
  getLargestVariant,
  getOptimizedImage,
  hasOptimizedVariants,
  setImageCdnEnabledForTests,
  setOptimizedImageVariantCatalogForTests
} from './images'
import { buildImageCdnUrl } from './imageCdn'
import { TARGET_WIDTHS } from './imagePaths'

const EMPTY = { variants: [], avifVariants: [] }

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
      '/img/optimized/example-640.avif',
      '/img/optimized/example-1280.avif'
    ])

    expect(getOptimizedImage('/img/example.png')).toEqual({
      variants: [
        { src: '/img/optimized/example-640.webp', width: 640 },
        { src: '/img/optimized/example-1280.webp', width: 1280 }
      ],
      avifVariants: [
        { src: '/img/optimized/example-640.avif', width: 640 },
        { src: '/img/optimized/example-1280.avif', width: 1280 }
      ]
    })
    expect(existsSpy).not.toHaveBeenCalled()
  })

  it('includes exact intrinsic-width variants from the catalog (INTORG-934)', () => {
    const base = '/img/optimized/foundation-blog/2026-06-02/www-presentation-1'
    setOptimizedImageVariantCatalogForTests([
      `${base}-640.webp`,
      `${base}-1200.webp`,
      `${base}-640.avif`,
      `${base}-1200.avif`
    ])

    expect(
      getOptimizedImage(
        '/img/foundation-blog/2026-06-02/www-presentation-1.webp'
      )
    ).toEqual({
      variants: [
        { src: `${base}-640.webp`, width: 640 },
        { src: `${base}-1200.webp`, width: 1200 }
      ],
      avifVariants: [
        { src: `${base}-640.avif`, width: 640 },
        { src: `${base}-1200.avif`, width: 1200 }
      ]
    })
  })

  it('ignores legacy -full files left in the catalog by an older pipeline', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/example-640.webp',
      '/img/optimized/example-full.webp',
      '/img/optimized/example-full.avif'
    ])

    expect(getOptimizedImage('/img/example.png')).toEqual({
      variants: [{ src: '/img/optimized/example-640.webp', width: 640 }],
      avifVariants: []
    })
  })

  it('maps upload originals to /img/optimized/uploads variants', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/uploads/hero-640.webp',
      '/img/optimized/uploads/hero-1280.webp'
    ])

    const result = getOptimizedImage('/uploads/img/original/hero.jpg')

    expect(result.variants).toEqual([
      { src: '/img/optimized/uploads/hero-640.webp', width: 640 },
      { src: '/img/optimized/uploads/hero-1280.webp', width: 1280 }
    ])
    expect(result.avifVariants).toEqual([])
  })

  it('returns empty data when the catalog has no matching variants', () => {
    setOptimizedImageVariantCatalogForTests([])

    expect(getOptimizedImage('/img/missing.png')).toEqual(EMPTY)
  })

  it('returns empty data for SVGs and unrecognized paths', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/logo-640.webp'])

    expect(getOptimizedImage('/img/logo.svg')).toEqual(EMPTY)
    expect(getOptimizedImage('/somewhere/else.png')).toEqual(EMPTY)
  })
})

describe('getLargestVariant', () => {
  it('returns the widest variant — the full-size render', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/example-640.webp',
      '/img/optimized/example-1280.webp',
      '/img/optimized/example-900.webp'
    ])

    expect(
      getLargestVariant(getOptimizedImage('/img/example.png').variants)
    ).toEqual({ src: '/img/optimized/example-1280.webp', width: 1280 })
  })

  it('returns null for an image with no variants', () => {
    expect(getLargestVariant([])).toBeNull()
  })
})

describe('hasOptimizedVariants', () => {
  it('is true when any variant exists', () => {
    setOptimizedImageVariantCatalogForTests(['/img/optimized/a-640.webp'])

    expect(hasOptimizedVariants(getOptimizedImage('/img/a.png'))).toBe(true)
  })

  it('is false for an image the pipeline never produced', () => {
    setOptimizedImageVariantCatalogForTests([])

    expect(hasOptimizedVariants(getOptimizedImage('/img/a.png'))).toBe(false)
  })
})

describe('getOptimizedImage — Netlify Image CDN mode', () => {
  it('returns CDN URLs for every target width, ignoring the catalog', () => {
    // Empty catalog: on Netlify the encoder never runs, so nothing is listed.
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

  it('never requests an unsized transform — that would duplicate the widest one', () => {
    setImageCdnEnabledForTests(true)

    const { variants, avifVariants } = getOptimizedImage('/img/hero.png')

    for (const { src } of [...variants, ...avifVariants]) {
      expect(src).toMatch(/[?&]w=\d+/)
    }
  })

  it('points the CDN at the upload original, not the optimized path', () => {
    setImageCdnEnabledForTests(true)

    const largest = getLargestVariant(
      getOptimizedImage('/uploads/img/original/hero.jpg').variants
    )

    expect(largest?.src).toContain(
      encodeURIComponent('/uploads/img/original/hero.jpg')
    )
    expect(largest?.src).not.toContain('optimized')
  })

  it('resolves absolute Strapi URLs to a same-origin CDN source', () => {
    setImageCdnEnabledForTests(true)

    const { variants } = getOptimizedImage(
      'https://cms.example.com/uploads/img/original/hero.jpg'
    )

    expect(variants[0].src).toBe(
      buildImageCdnUrl('/uploads/img/original/hero.jpg', {
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
