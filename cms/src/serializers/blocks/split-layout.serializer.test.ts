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
