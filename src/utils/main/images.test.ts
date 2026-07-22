import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import {
  getOptimizedImage,
  setOptimizedImageVariantCatalogForTests
} from './images'

afterEach(() => {
  setOptimizedImageVariantCatalogForTests(null)
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
