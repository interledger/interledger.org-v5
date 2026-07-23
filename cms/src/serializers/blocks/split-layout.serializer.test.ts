import { describe, it, expect } from 'vitest'
import { serialize } from './split-layout.serializer'

describe('split-layout serializer', () => {
  it('serializes left image position so Strapi publishes update MDX', () => {
    const result = serialize({
      imagePosition: 'left',
      imageAlt: 'Component scoped alt',
      image: {
        url: '/uploads/education_grant.jpg',
        alternativeText: 'Students collaborating'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imagePosition="left"')
    expect(result).toContain('imageAlt="Component scoped alt"')
    expect(result).not.toContain('Students collaborating')
  })

  it('falls back to media alternativeText when component imageAlt is absent', () => {
    const result = serialize({
      image: {
        url: '/uploads/education_grant.jpg',
        alternativeText: 'Media library alt'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imageAlt="Media library alt"')
  })

  it('omits image position when it is the default right value', () => {
    const result = serialize({
      imagePosition: 'right',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Some body copy.'
    })

    expect(result).not.toContain('imagePosition=')
  })

  it('omits displayRatio when it is the default 2:1 value', () => {
    const result = serialize({
      displayRatio: '2:1',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Some body copy.'
    })

    expect(result).not.toContain('displayRatio=')
  })

  it('serializes non-default displayRatio so Strapi publishes update MDX', () => {
    const result = serialize({
      displayRatio: '1:1',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Some body copy.'
    })

    expect(result).toContain('displayRatio="1:1"')
  })

  it('rejects unsupported displayRatio values', () => {
    expect(() =>
      serialize({
        displayRatio: '3:1',
        image: { url: '/uploads/education_grant.jpg' },
        content: 'Text body.'
      })
    ).toThrow(
      'Split layout displayRatio must be one of 1:1, 1:2, 2:1. Received "3:1".'
    )
  })

  it('uses layoutType to ignore stale quote fields for image-text layouts', () => {
    const result = serialize({
      layoutType: 'image-text',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Text body.',
      quote: 'Stale quote from a previous layout.',
      quoteSource: 'Stale source'
    })

    expect(result).toContain('Text body.')
    expect(result).not.toContain('quote=')
    expect(result).not.toContain('quoteSource=')
    expect(result).not.toContain('Stale quote')
  })

  it('uses layoutType to serialize quote fields for image-quote layouts', () => {
    const result = serialize({
      layoutType: 'image-quote',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Stale text body.',
      quote: 'Quoted body.',
      quoteSource: 'Interledger'
    })

    expect(result).toContain('layoutType="image-quote"')
    expect(result).toContain('quote="Quoted body."')
    expect(result).toContain('quoteSource="Interledger"')
    expect(result).not.toContain('Stale text body.')
  })

  it('ignores a stale CTA left over from a text layout when switched to quote', () => {
    const result = serialize({
      layoutType: 'image-quote',
      image: { url: '/uploads/education_grant.jpg' },
      quote: 'Quoted body.',
      cta: { text: 'Stale CTA', link: 'https://example.com' }
    })

    expect(result).toContain('quote="Quoted body."')
    expect(result).not.toContain('ctaText=')
    expect(result).not.toContain('ctaLink=')
  })

  it('serializes CTA for text layouts', () => {
    const result = serialize({
      layoutType: 'image-text',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Text body.',
      cta: { text: 'Apply now', link: 'https://example.com' }
    })

    expect(result).toContain('ctaText="Apply now"')
    expect(result).toContain('ctaLink="https://example.com"')
  })

  it('throws when an image layout has no image at all', () => {
    expect(() =>
      serialize({ layoutType: 'image-text', content: 'Text body.' })
    ).toThrow('Split layout image variants require an image')
  })

  it('accepts a raw upload ID for image (unpopulated document-service payload)', () => {
    const result = serialize({
      layoutType: 'image-quote',
      image: 42,
      quote: 'Quoted body.'
    })

    expect(result).toContain('quote="Quoted body."')
    expect(result).not.toContain('imageSrc=')
  })

  it('rejects unsupported layoutType values', () => {
    expect(() =>
      serialize({
        layoutType: 'image-grid',
        image: { url: '/uploads/education_grant.jpg' },
        content: 'Text body.'
      })
    ).toThrow(
      'Split layout type must be one of image-text, image-quote, video-text, video-quote. Received "image-grid".'
    )
  })
})
