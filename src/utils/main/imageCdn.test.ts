import { describe, expect, it } from 'vitest'
import {
  NETLIFY_IMAGE_ENDPOINT,
  buildImageCdnUrl,
  buildImageCdnVariants,
  isImageCdnEnabled,
  largestTargetWidth
} from './imageCdn'
import { AVIF_QUALITY, TARGET_WIDTHS, WEBP_QUALITY } from './imagePaths'

describe('isImageCdnEnabled', () => {
  it('is off for a plain local build — /.netlify/images does not exist off-platform', () => {
    expect(isImageCdnEnabled({})).toBe(false)
  })

  it('is on inside a Netlify build', () => {
    expect(isImageCdnEnabled({ NETLIFY: 'true' })).toBe(true)
  })

  it('treats any non-falsey NETLIFY value as set', () => {
    expect(isImageCdnEnabled({ NETLIFY: '1' })).toBe(true)
    expect(isImageCdnEnabled({ NETLIFY: 'yes' })).toBe(true)
  })

  it.each(['', '0', 'false', 'FALSE', 'no', 'off', '  '])(
    'does not treat NETLIFY=%j as set',
    (value) => {
      expect(isImageCdnEnabled({ NETLIFY: value })).toBe(false)
    }
  )

  it('is on when CI opts in explicitly, with no NETLIFY present', () => {
    expect(isImageCdnEnabled({ IMAGE_CDN: 'on' })).toBe(true)
    expect(isImageCdnEnabled({ IMAGE_CDN: 'ON' })).toBe(true)
  })

  it('honours IMAGE_CDN=off as an escape hatch on Netlify', () => {
    expect(isImageCdnEnabled({ NETLIFY: 'true', IMAGE_CDN: 'off' })).toBe(false)
    expect(isImageCdnEnabled({ NETLIFY: 'true', IMAGE_CDN: 'OFF' })).toBe(false)
  })

  it('falls back to auto-detection for an unrecognised IMAGE_CDN value', () => {
    expect(isImageCdnEnabled({ NETLIFY: 'true', IMAGE_CDN: 'maybe' })).toBe(
      true
    )
    expect(isImageCdnEnabled({ IMAGE_CDN: 'maybe' })).toBe(false)
  })
})

describe('buildImageCdnUrl', () => {
  it('builds a width-constrained transformation URL', () => {
    expect(
      buildImageCdnUrl('/img/hero.png', { format: 'webp', width: 640 })
    ).toBe(
      `${NETLIFY_IMAGE_ENDPOINT}?url=%2Fimg%2Fhero.png&fm=webp&w=640&q=${WEBP_QUALITY}`
    )
  })

  it('always sends a width — an unsized URL duplicates the widest transform', () => {
    expect(
      buildImageCdnUrl('/img/hero.png', { format: 'avif', width: 3840 })
    ).toBe(
      `${NETLIFY_IMAGE_ENDPOINT}?url=%2Fimg%2Fhero.png&fm=avif&w=3840&q=${AVIF_QUALITY}`
    )
  })

  it('uses the same quality as the build-time encoder for each format', () => {
    const read = (format: 'webp' | 'avif') =>
      new URL(
        buildImageCdnUrl('/img/a.png', { format, width: 640 }),
        'https://example.com'
      ).searchParams.get('q')

    expect(read('webp')).toBe(String(WEBP_QUALITY))
    expect(read('avif')).toBe(String(AVIF_QUALITY))
  })

  it('percent-encodes paths with spaces and unicode', () => {
    const url = buildImageCdnUrl('/uploads/img/original/Årsrapport 2026.png', {
      format: 'webp',
      width: 1280
    })

    expect(url).not.toContain(' ')
    expect(new URL(url, 'https://example.com').searchParams.get('url')).toBe(
      '/uploads/img/original/Årsrapport 2026.png'
    )
  })
})

describe('buildImageCdnVariants', () => {
  it('emits one URL per target width, ascending', () => {
    const variants = buildImageCdnVariants('/img/hero.png', 'webp')

    expect(variants.map((v) => v.width)).toEqual([...TARGET_WIDTHS])
    expect(variants[0].src).toContain('w=640')
  })

  it('offers widths above the source size — Netlify clamps rather than upscaling', () => {
    // Verified against the deploy: w=3840 on a 640px source returns 640px, so
    // the srcset does not need the intrinsic width to stay safe.
    expect(buildImageCdnVariants('/img/tiny.png', 'avif')).toHaveLength(
      TARGET_WIDTHS.length
    )
  })

  it('accepts an explicit width list', () => {
    expect(
      buildImageCdnVariants('/img/hero.png', 'webp', [320, 640]).map(
        (v) => v.width
      )
    ).toEqual([320, 640])
  })
})

describe('largestTargetWidth', () => {
  it('is the widest configured target', () => {
    expect(largestTargetWidth()).toBe(Math.max(...TARGET_WIDTHS))
  })
})
