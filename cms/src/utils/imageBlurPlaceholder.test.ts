import { describe, it, expect, vi, beforeEach } from 'vitest'

const toBuffer = vi.fn()
const webp = vi.fn(() => ({ toBuffer }))
const resize = vi.fn(() => ({ webp }))
const sharpMock = vi.fn(() => ({ resize }))

vi.mock('sharp', () => ({ default: sharpMock }))

const { generateBlurPlaceholder } = await import('./imageBlurPlaceholder')

describe('generateBlurPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a base64 webp data URI for a local /uploads/ path', async () => {
    toBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'))

    const result = await generateBlurPlaceholder(
      '/uploads/img/original/hero.jpg'
    )

    expect(result).toBe(
      `data:image/webp;base64,${Buffer.from('fake-image-bytes').toString('base64')}`
    )
    expect(resize).toHaveBeenCalledWith(20, null, { fit: 'inside' })
    expect(webp).toHaveBeenCalledWith({ quality: 40 })
  })

  it('returns a base64 webp data URI for a local /img/ path', async () => {
    toBuffer.mockResolvedValue(Buffer.from('x'))

    const result = await generateBlurPlaceholder('/img/homepage/hero.webp')

    expect(result).not.toBeInstanceOf(Error)
    expect(sharpMock).toHaveBeenCalled()
  })

  it('rejects a non-local (remote) URL without touching sharp', async () => {
    const result = await generateBlurPlaceholder('https://example.com/hero.jpg')

    expect(result).toBeInstanceOf(Error)
    expect(sharpMock).not.toHaveBeenCalled()
  })

  it('resolves an absolute upload URL (STRAPI_UPLOADS_BASE_URL set) back to the local file', async () => {
    toBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'))

    const result = await generateBlurPlaceholder(
      'https://cdn.example.com/uploads/img/original/hero.jpg'
    )

    expect(result).toBe(
      `data:image/webp;base64,${Buffer.from('fake-image-bytes').toString('base64')}`
    )
    expect(sharpMock).toHaveBeenCalledWith(
      expect.stringContaining('/uploads/img/original/hero.jpg')
    )
  })

  it('returns an Error instead of throwing when sharp fails (missing/corrupt file)', async () => {
    toBuffer.mockRejectedValue(new Error('Input file is missing'))

    const result = await generateBlurPlaceholder(
      '/uploads/img/original/gone.jpg'
    )

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('Input file is missing')
  })
})
