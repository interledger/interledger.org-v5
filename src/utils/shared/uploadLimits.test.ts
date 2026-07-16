import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGE_BYTES,
  formatImageSize,
  imageSizeLimitError,
  isImageOverSizeLimit
} from './uploadLimits'

describe('uploadLimits', () => {
  it('allows images at or below 2 MB', () => {
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES)).toBe(false)
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES - 1)).toBe(false)
  })

  it('rejects images over 2 MB', () => {
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES + 1)).toBe(true)
  })

  it('formats sizes for error messages', () => {
    expect(formatImageSize(512)).toBe('0.5 KB')
    expect(formatImageSize(2 * 1024 * 1024)).toBe('2.00 MB')
  })

  it('builds a human-readable limit error', () => {
    expect(imageSizeLimitError('/img/hero.png', MAX_IMAGE_BYTES + 1)).toContain(
      '2 MB'
    )
  })
})
