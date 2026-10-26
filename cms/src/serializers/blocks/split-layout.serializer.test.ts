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

  it('ignores a stale CTA left over from a text layout when switched to quote', () => {
    const result = serialize({
      layoutType: 'image-quote',
      media: { image: { url: '/uploads/education_grant.jpg' } },
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
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Text body.',
      cta: { text: 'Apply now', link: 'https://example.com' }
    })

    expect(result).toContain(
      'buttons={[{"text":"Apply now","link":"https://example.com","style":"primary"}]}'
    )
    expect(result).not.toContain('ctaText=')
  })

  it('serializes the CTA external flag', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Text body.',
      cta: { text: 'Partner site', link: 'https://example.com', external: true }
    })

    expect(result).toContain('"external":true')
    expect(result).not.toContain('"document"')
  })

  it('serializes the CTA document flag', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Text body.',
      cta: {
        text: 'Application pack',
        link: '/uploads/pack.pdf',
        document: true
      }
    })

    expect(result).toContain('"document":true')
    expect(result).not.toContain('"external"')
  })

  it('throws when the CTA is both external and a document', () => {
    expect(() =>
      serialize({
        layoutType: 'image-text',
        media: { image: { url: '/uploads/education_grant.jpg' } },
        content: 'Text body.',
        cta: {
          text: 'Application pack',
          link: '/uploads/pack.pdf',
          external: true,
          document: true
        }
      })
    ).toThrow('cannot be both external and document')
  })

  it('omits the CTA external and document flags when they are unset', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/uploads/education_grant.jpg' } },
      content: 'Text body.',
      cta: { text: 'Apply now', link: '/apply' }
    })

    expect(result).not.toContain('ctaExternal=')
    expect(result).not.toContain('ctaDocument=')
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

  it('prefers the button group over a legacy cta', () => {
    const result = serialize({
      layoutType: 'image-text',
      media: { image: { url: '/img/a.png' } },
      content: 'Body.',
      buttons: [{ text: 'New', link: '/new/', style: 'primary' }],
      cta: { text: 'Old', link: '/old/' }
    })
    expect(result).toContain('"text":"New"')
    expect(result).not.toContain('Old')
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
