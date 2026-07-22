import { describe, it, expect } from 'vitest'
import { serialize } from './image-block.serializer'

describe('image-block serializer', () => {
  it('serializes src and alt from localized media', () => {
    const result = serialize({
      media: {
        image: { url: '/uploads/photo.jpg' },
        alternativeText: 'A photo'
      }
    })

    expect(result).toBe('<ImageBlock src="/uploads/photo.jpg" alt="A photo" />')
  })

  it('falls back to the image alternativeText when media.alternativeText is unset', () => {
    const result = serialize({
      media: { image: { url: '/uploads/photo.jpg', alternativeText: 'Fallback alt' } }
    })

    expect(result).toContain('alt="Fallback alt"')
  })

  it('defaults alt to empty string when neither is set', () => {
    const result = serialize({ media: { image: { url: '/uploads/photo.jpg' } } })

    expect(result).toContain('alt=""')
  })

  it('includes tabletSrc and mobileSrc when present', () => {
    const result = serialize({
      media: { image: { url: '/uploads/desktop.jpg' } },
      tabletImage: { url: '/uploads/tablet.jpg' },
      mobileImage: { url: '/uploads/mobile.jpg' }
    })

    expect(result).toContain('tabletSrc="/uploads/tablet.jpg"')
    expect(result).toContain('mobileSrc="/uploads/mobile.jpg"')
  })

  it('omits tabletSrc and mobileSrc when not provided', () => {
    const result = serialize({ media: { image: { url: '/uploads/desktop.jpg' } } })

    expect(result).not.toContain('tabletSrc')
    expect(result).not.toContain('mobileSrc')
  })

  it('omits needsFullView and needsOutline when false or unset', () => {
    const result = serialize({
      media: { image: { url: '/uploads/photo.jpg' } },
      needsFullView: false,
      needsOutline: false
    })

    expect(result).not.toContain('needsFullView')
    expect(result).not.toContain('needsOutline')
  })

  it('includes needsFullView when true', () => {
    const result = serialize({
      media: { image: { url: '/uploads/photo.jpg' } },
      needsFullView: true
    })

    expect(result).toContain('needsFullView={true}')
  })

  it('includes needsOutline when true', () => {
    const result = serialize({
      media: { image: { url: '/uploads/photo.jpg' } },
      needsOutline: true
    })

    expect(result).toContain('needsOutline={true}')
  })

  it('escapes special characters in alt text', () => {
    const result = serialize({
      media: {
        image: { url: '/uploads/photo.jpg' },
        alternativeText: 'Q&A: "Live" Session'
      }
    })

    expect(result).toContain('alt="Q&amp;A: &quot;Live&quot; Session"')
    expect(result).not.toContain('\\"')
  })

  it('produces a self-closing ImageBlock tag', () => {
    const result = serialize({ media: { image: { url: '/uploads/photo.jpg' } } })

    expect(result).toMatch(/^<ImageBlock .* \/>$/)
  })

  it('throws when media is missing', () => {
    expect(() => serialize({})).toThrow('ImageBlock block is missing image')
  })

  it('throws when media.image is missing', () => {
    expect(() =>
      serialize({ media: { alternativeText: 'No image' } })
    ).toThrow('ImageBlock block is missing image')
  })

  it('throws when media.image has no url', () => {
    expect(() =>
      serialize({ media: { image: { alternativeText: 'No URL' } } })
    ).toThrow('ImageBlock block is missing image')
  })

  it('accepts a raw upload ID for media.image (unpopulated document-service payload)', () => {
    const result = serialize({ media: { image: 42 } })

    expect(result).not.toContain('src=')
    expect(result).toContain('alt=""')
  })
})
