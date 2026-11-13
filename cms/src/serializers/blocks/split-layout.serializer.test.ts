import { describe, it, expect } from 'vitest'
import { serialize } from './split-layout.serializer'

describe('split-layout serializer', () => {
  it('serializes left image position so Strapi publishes update MDX', () => {
    const result = serialize({
      imagePosition: 'left',
      media: {
        image: { url: '/uploads/education_grant.jpg' },
        alternativeText: 'Students collaborating'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imagePosition="left"')
    expect(result).toContain('imageAlt="Students collaborating"')
  })

  it('serializes body content as blank-line-separated JSX children', () => {
    const result = serialize({
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Some body copy.'
    })

    expect(result).toBe(
      '<SplitLayout imageSrc="/uploads/education_grant.jpg">\n\nSome body copy.\n\n</SplitLayout>'
    )
  })

  it('falls back to the image alternativeText when media.alternativeText is unset', () => {
    const result = serialize({
      media: {
        image: {
          url: '/uploads/education_grant.jpg',
          alternativeText: 'Media library alt'
        }
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imageAlt="Media library alt"')
  })

  it('falls back to the image alternativeText when media.alternativeText is null', () => {
    const result = serialize({
      media: {
        image: {
          url: '/uploads/education_grant.jpg',
          alternativeText: 'Media library alt'
        },
        alternativeText: null
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imageAlt="Media library alt"')
  })

  it('omits imageAlt when media.alternativeText is explicitly empty', () => {
    const result = serialize({
      media: {
        image: {
          url: '/uploads/education_grant.jpg',
          alternativeText: 'Media library alt'
        },
        alternativeText: ''
      },
      content: 'Some body copy.'
    })

    // SplitLayout only emits imageAlt when truthy; empty stays decorative.
    expect(result).not.toContain('imageAlt=')
  })

  it('omits image position when it is the default right value', () => {
    const result = serialize({
      imagePosition: 'right',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Some body copy.'
    })

    expect(result).not.toContain('imagePosition=')
  })

  it('omits displayRatio when it is the default 2:1 value', () => {
    const result = serialize({
      displayRatio: '2:1',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Some body copy.'
    })

    expect(result).not.toContain('displayRatio=')
  })

  it('serializes a video cover image as imageSrc', () => {
    const result = serialize({
      layoutType: 'video-text',
      videoUrl: 'https://www.youtube.com/watch?v=abc',
      media: {
        image: { url: '/uploads/talk_poster.jpg' },
        alternativeText: 'Talk still'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('layoutType="video-text"')
    expect(result).toContain('videoUrl="https://www.youtube.com/watch?v=abc"')
    expect(result).toContain('imageSrc="/uploads/talk_poster.jpg"')
    expect(result).toContain('imageAlt="Talk still"')
    expect(result).not.toContain('videoTitle=')
  })

  it('serializes a posterless video title without an image alt', () => {
    const result = serialize({
      layoutType: 'video-text',
      displayRatio: '1:1',
      videoUrl: 'https://youtu.be/G0GSrKTekdA',
      videoTitle: 'Thank you for being part of Summit 2023',
      content: 'Some body copy.'
    })

    expect(result).toContain(
      'videoTitle="Thank you for being part of Summit 2023"'
    )
    expect(result).toContain('videoUrl="https://youtu.be/G0GSrKTekdA"')
    expect(result).not.toContain('imageAlt=')
    expect(result).not.toContain('imageSrc=')
  })

  it('keeps a video title distinct from the poster alt', () => {
    const result = serialize({
      layoutType: 'video-text',
      videoUrl: 'https://youtu.be/4UVw1gQNGp0',
      videoTitle: 'Future | Money Arts & Culture Grant',
      media: {
        image: { url: '/uploads/talk_poster.jpg' },
        alternativeText: 'Talk still'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('videoTitle="Future | Money Arts & Culture Grant"')
    expect(result).toContain('imageAlt="Talk still"')
    expect(result).toContain('imageSrc="/uploads/talk_poster.jpg"')
  })

  it('preserves an accented video title', () => {
    const result = serialize({
      layoutType: 'video-text',
      videoUrl: 'https://youtu.be/abc',
      videoTitle: 'Ponte al día con las charlas 2023',
      content: 'Body.'
    })

    expect(result).toContain('videoTitle="Ponte al día con las charlas 2023"')
  })

  it('omits a blank video title', () => {
    const result = serialize({
      layoutType: 'video-text',
      videoUrl: 'https://youtu.be/abc',
      videoTitle: '   ',
      content: 'Body.'
    })

    expect(result).not.toContain('videoTitle=')
  })

  it('does not emit a stale video title on an image layout', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      videoTitle: 'Stale title',
      content: 'Some body copy.'
    })

    expect(result).not.toContain('videoTitle=')
    expect(result).not.toContain('Stale title')
  })

  it('serializes non-default displayRatio so Strapi publishes update MDX', () => {
    const result = serialize({
      displayRatio: '1:1',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Some body copy.'
    })

    expect(result).toContain('displayRatio="1:1"')
  })

  it('rejects unsupported displayRatio values', () => {
    expect(() =>
      serialize({
        displayRatio: '3:1',
        media: { image: { url: '/uploads/education_grant.jpg' } },
        content: 'Text body.'
      })
    ).toThrow(
      'Split layout displayRatio must be one of 3:2, 2:1, 1:1, 1:2. Received "3:1".'
    )
  })

  it('uses layoutType to ignore stale quote fields for image-text layouts', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
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
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Stale text body.',
      quote: 'Quoted body.',
      quoteSource: 'Interledger'
    })

    expect(result).toContain('layoutType="image-quote"')
    expect(result).toContain('quote="Quoted body."')
    expect(result).toContain('quoteSource="Interledger"')
    expect(result).not.toContain('Stale text body.')
  })

  it('ignores stale buttons left over from a text layout when switched to quote', () => {
    const result = serialize({
      layoutType: 'image-quote',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      quote: 'Quoted body.',
      buttons: [{ text: 'Stale CTA', link: 'https://example.com' }]
    })

    expect(result).toContain('quote="Quoted body."')
    expect(result).not.toContain('buttons=')
  })

  it('serializes a single button for text layouts', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Text body.',
      buttons: [{ text: 'Apply now', link: 'https://example.com' }]
    })

    expect(result).toContain(
      'buttons={[{"text":"Apply now","link":"https://example.com","style":"primary"}]}'
    )
  })

  it('throws when an image layout has no image at all', () => {
    expect(() =>
      serialize({ layoutType: 'image-text', content: 'Text body.' })
    ).toThrow('Split layout image variants require an image')
  })

  it('accepts a raw upload ID for media.image (unpopulated document-service payload)', () => {
    const result = serialize({
      layoutType: 'image-quote',
      media: { image: 42 },
      quote: 'Quoted body.'
    })

    expect(result).toContain('quote="Quoted body."')
    expect(result).not.toContain('imageSrc=')
  })

  it('rejects unsupported layoutType values', () => {
    expect(() =>
      serialize({
        layoutType: 'image-grid',
        media: { image: { url: '/uploads/education_grant.jpg' } },
        content: 'Text body.'
      })
    ).toThrow(
      'Split layout type must be one of image-text, image-quote, video-text, video-quote. Received "image-grid".'
    )
  })

  it('serializes the intro, the button group and the 3:2 ratio', () => {
    const result = serialize({
      layoutType: 'image-text',
      displayRatio: '3:2',
      media: { image: { url: '/img/a.png' }, alternativeText: 'A' },
      intro: { heading: 'Heading', description: 'Text.' },
      buttons: [
        { text: 'Apply', link: '/apply/', style: 'primary' },
        { text: 'Learn more', link: '/more/', style: 'secondary' }
      ]
    })
    expect(result).toContain(
      '<SplitLayout intro={{"heading":"Heading","description":"Text."}} displayRatio="3:2"'
    )
    expect(result).toContain(
      'buttons={[{"text":"Apply","link":"/apply/","style":"primary"},{"text":"Learn more","link":"/more/","style":"secondary"}]}'
    )
    // An intro alone is enough for a text layout.
    expect(result).toMatch(/\/>$/)
  })

  it('still requires content or an intro for text layouts', () => {
    expect(() =>
      serialize({
        layoutType: 'image-text',
        media: { image: { url: '/img/a.png' } }
      })
    ).toThrow('Split layout text variants require content or an intro')
  })
})
