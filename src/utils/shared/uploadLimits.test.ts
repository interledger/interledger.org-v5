import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGE_BYTES,
  formatFileSize,
  imageOverSizeLimitError,
  imageSizeLimitError,
  isImageOverSizeLimit
} from './uploadLimits'

describe('uploadLimits', () => {
  it('allows images at or below 2 MB', () => {
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES)).toBe(false)
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES - 1)).toBe(false)
    expect(isImageOverSizeLimit(0)).toBe(false)
  })

  it('rejects images over 2 MB', () => {
    expect(isImageOverSizeLimit(MAX_IMAGE_BYTES + 1)).toBe(true)
  })

  it('formats sizes for error messages', () => {
    expect(formatFileSize(512)).toBe('0.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB')
  })

  it('names the actual size, the limit, and a remedy', () => {
    const message = imageSizeLimitError('hero.png', 3 * 1024 * 1024)

    expect(message).toContain('hero.png')
    expect(message).toContain('3.00 MB')
    expect(message).toContain('2 MB')
    expect(message).toMatch(/resize or compress/i)
  })

  it('omits the size when only "over the limit" is known', () => {
    const message = imageOverSizeLimitError('hero.png')

    expect(message).toContain('hero.png')
    expect(message).toContain('2 MB')
    expect(message).not.toMatch(/\d+\.\d+ MB/)
  })
})
