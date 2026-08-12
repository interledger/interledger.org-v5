import { describe, expect, it } from 'vitest'
import { encodeImageUrlPath, hasOptimizableRasterExtension } from './imagePaths'

describe('hasOptimizableRasterExtension', () => {
  it('accepts the extensions the encoder produces variants for', () => {
    expect(hasOptimizableRasterExtension('/img/hero.jpg')).toBe(true)
    expect(hasOptimizableRasterExtension('/img/hero.jpeg')).toBe(true)
    expect(hasOptimizableRasterExtension('/img/hero.png')).toBe(true)
    expect(hasOptimizableRasterExtension('/img/hero.webp')).toBe(true)
    expect(hasOptimizableRasterExtension('/img/hero.avif')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(
      hasOptimizableRasterExtension('/uploads/img/original/erica.JPG')
    ).toBe(true)
    expect(hasOptimizableRasterExtension('/img/HERO.PNG')).toBe(true)
  })

  it('rejects formats that ship as-is', () => {
    expect(hasOptimizableRasterExtension('/img/logo.svg')).toBe(false)
    expect(hasOptimizableRasterExtension('/img/anim.gif')).toBe(false)
  })

  it('rejects raster formats outside the allowlist', () => {
    // Strapi accepts .tiff uploads, but the encoder never emits variants for
    // one, so it must not be treated as optimizable anywhere either.
    expect(
      hasOptimizableRasterExtension('/uploads/img/original/scan.tiff')
    ).toBe(false)
    expect(hasOptimizableRasterExtension('/img/old.bmp')).toBe(false)
  })

  it('rejects extensionless paths', () => {
    expect(hasOptimizableRasterExtension('/img/noext')).toBe(false)
    expect(hasOptimizableRasterExtension('')).toBe(false)
  })

  it('ignores a query string or fragment', () => {
    expect(hasOptimizableRasterExtension('/img/hero.png?v=2')).toBe(true)
    expect(hasOptimizableRasterExtension('/img/logo.svg?updated=1')).toBe(false)
    expect(hasOptimizableRasterExtension('/img/hero.png#frag')).toBe(true)
  })

  it('does not read a dot from a parent directory as the extension', () => {
    expect(hasOptimizableRasterExtension('/img/v1.2/hero')).toBe(false)
    expect(hasOptimizableRasterExtension('/img/v1.2/hero.png')).toBe(true)
  })

  it('handles native filesystem paths, as the encoder passes them', () => {
    expect(hasOptimizableRasterExtension('/repo/public/img/hero.png')).toBe(
      true
    )
    expect(
      hasOptimizableRasterExtension('C:\\repo\\public\\img\\hero.png')
    ).toBe(true)
    expect(hasOptimizableRasterExtension('C:\\repo\\public\\img\\noext')).toBe(
      false
    )
  })
})

describe('encodeImageUrlPath', () => {
  it('leaves an ordinary path untouched', () => {
    expect(encodeImageUrlPath('/img/foundation-blog/hero.png')).toBe(
      '/img/foundation-blog/hero.png'
    )
  })

  it('preserves the path separators', () => {
    expect(encodeImageUrlPath('/uploads/img/original/a/b/c.png')).toBe(
      '/uploads/img/original/a/b/c.png'
    )
  })

  it('encodes characters that break a srcset entry', () => {
    // A space splits url from descriptor; a comma splits one entry into two.
    expect(encodeImageUrlPath('/img/hero image.avif')).toBe(
      '/img/hero%20image.avif'
    )
    expect(encodeImageUrlPath('/img/hero,wide.avif')).toBe(
      '/img/hero%2Cwide.avif'
    )
  })

  it('encodes characters that encodeURI would leave to corrupt the URL', () => {
    // The reason this is per-segment encodeURIComponent rather than encodeURI.
    expect(encodeImageUrlPath('/img/hero#1.png')).toBe('/img/hero%231.png')
    expect(encodeImageUrlPath('/img/what?.png')).toBe('/img/what%3F.png')
    expect(encodeImageUrlPath('/img/a&b.png')).toBe('/img/a%26b.png')
    expect(encodeImageUrlPath('/img/a+b.png')).toBe('/img/a%2Bb.png')
    expect(encodeImageUrlPath('/img/100%.png')).toBe('/img/100%25.png')
  })

  it('round-trips through decodeURIComponent', () => {
    for (const literal of [
      '/img/hero image.avif',
      '/img/hero,wide.avif',
      '/img/100%.png',
      '/img/a+b&c#d.png'
    ]) {
      expect(decodeURIComponent(encodeImageUrlPath(literal))).toBe(literal)
    }
  })
})
