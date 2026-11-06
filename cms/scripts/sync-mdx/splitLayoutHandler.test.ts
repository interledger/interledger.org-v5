import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers SplitLayout handler
import './splitLayoutHandler'

const TEST_IMAGE_SRC = '/img/foo.jpg'
const MISSING_IMAGE_SRC = '/img/missing.jpg'

/** Stub Strapi media-library IDs returned by resolveMediaUpload in tests. */
const STRAPI_UPLOAD_ID = {
  primaryImage: 42,
  defaultLayoutImage: 7,
  layoutTypeScopedImage: 11,
  mixedContentImage: 3
} as const

function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message: `Upload "${url}" not found.`,
          component: 'SplitLayout',
          prop: 'imageSrc'
        })
      }
      return id
    }
  }
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('SplitLayout handler', () => {
  it('parses an image and text layout with left image position', async () => {
    const mdx = [
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" imagePosition="left" buttons={[{"text":"Apply","link":"https://example.com","external":true}]}>`,
      '',
      'Some **body** copy.',
      '',
      '</SplitLayout>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(
      mdx,
      ctxWith({
        [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage
      })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'left',
        displayRatio: '2:1',
        media: { image: STRAPI_UPLOAD_ID.primaryImage, alternativeText: null },
        content: 'Some **body** copy.',
        buttons: [
          {
            text: 'Apply',
            link: 'https://example.com',
            style: 'primary',
            external: true
          }
        ]
      }
    ])
  })

  it('parses imageAlt into media.alternativeText', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" imageAlt="Foo alt">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).toMatchObject({
      media: {
        image: STRAPI_UPLOAD_ID.primaryImage,
        alternativeText: 'Foo alt'
      }
    })
  })

  it('keeps explicit empty imageAlt as empty string for decorative images', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" imageAlt="">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).toMatchObject({
      media: {
        image: STRAPI_UPLOAD_ID.primaryImage,
        alternativeText: ''
      }
    })
  })

  it('defaults imagePosition to right and omits optional fields when absent', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.defaultLayoutImage })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'right',
        displayRatio: '2:1',
        media: {
          image: STRAPI_UPLOAD_ID.defaultLayoutImage,
          alternativeText: null
        },
        content: 'Body.'
      }
    ])
    expect(blocks[0]).not.toHaveProperty('cta')
    expect(blocks[0]).not.toHaveProperty('videoUrl')
    expect(blocks[0]).not.toHaveProperty('quote')
    expect(blocks[0]).not.toHaveProperty('quoteSource')
  })

  it('parses a video and quote layout', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout videoUrl="https://vimeo.com/123" quote="Open payments matter." quoteSource="Interledger" />',
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'video-quote',
        imagePosition: 'right',
        displayRatio: '2:1',
        videoUrl: 'https://vimeo.com/123',
        quote: 'Open payments matter.',
        quoteSource: 'Interledger'
      }
    ])
  })

  it('stores imageSrc as the video cover on a video-text layout', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout layoutType="video-text" videoUrl="https://www.youtube.com/watch?v=abc" imageSrc="${TEST_IMAGE_SRC}" imageAlt="Talk still">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'video-text',
        imagePosition: 'right',
        displayRatio: '2:1',
        videoUrl: 'https://www.youtube.com/watch?v=abc',
        media: {
          image: STRAPI_UPLOAD_ID.primaryImage,
          alternativeText: 'Talk still'
        },
        content: 'Body.'
      }
    ])
    expect(blocks[0]).not.toHaveProperty('videoTitle')
  })

  it('keeps a posterless imageAlt as the video title', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout layoutType="video-text" displayRatio="1:1" videoUrl="https://youtu.be/G0GSrKTekdA" imageAlt="Thank you for being part of Summit 2023">Body.</SplitLayout>',
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'video-text',
        imagePosition: 'right',
        displayRatio: '1:1',
        videoUrl: 'https://youtu.be/G0GSrKTekdA',
        videoTitle: 'Thank you for being part of Summit 2023',
        content: 'Body.'
      }
    ])
    expect(blocks[0]).not.toHaveProperty('media')
  })

  it('stores an explicit video title apart from the poster alt', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout layoutType="video-text" videoUrl="https://youtu.be/4UVw1gQNGp0" videoTitle="Future | Money Arts & Culture Grant" imageSrc="${TEST_IMAGE_SRC}" imageAlt="Talk still">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).toMatchObject({
      videoTitle: 'Future | Money Arts & Culture Grant',
      media: {
        image: STRAPI_UPLOAD_ID.primaryImage,
        alternativeText: 'Talk still'
      }
    })
  })

  it('trims a video title and keeps an accented one', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout layoutType="video-text" videoUrl="https://youtu.be/abc" videoTitle="  Ponte al día con las charlas 2023  " />',
      { locale: 'es' }
    )

    expect(blocks[0]).toMatchObject({
      videoTitle: 'Ponte al día con las charlas 2023'
    })
    expect(blocks[0]).not.toHaveProperty('media')
  })

  it('drops a blank video title and does not copy a poster alt into it', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout layoutType="video-text" videoUrl="https://youtu.be/abc" videoTitle="   " imageSrc="${TEST_IMAGE_SRC}" imageAlt="Talk still">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).not.toHaveProperty('videoTitle')
    expect(blocks[0]).toMatchObject({
      media: { alternativeText: 'Talk still' }
    })
  })

  it('does not treat imageAlt as a video title on an image layout', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" imageAlt="Foo alt">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).not.toHaveProperty('videoTitle')
  })

  it('uses layoutType to ignore stale quote attributes for text layouts', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout layoutType="image-text" imageSrc="${TEST_IMAGE_SRC}" quote="Stale quote" quoteSource="Stale source">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.layoutTypeScopedImage })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'right',
        displayRatio: '2:1',
        media: {
          image: STRAPI_UPLOAD_ID.layoutTypeScopedImage,
          alternativeText: null
        },
        content: 'Body.'
      }
    ])
  })
  it('parses displayRatio when provided', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" displayRatio="1:1">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.split-layout',
      displayRatio: '1:1'
    })
  })

  it('defaults displayRatio to 2:1 when omitted', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.defaultLayoutImage })
    )

    expect(blocks[0]).toMatchObject({ displayRatio: '2:1' })
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('SplitLayout handler — errors', () => {
  it('returns INVALID_PROP_VALUE for unsupported imagePosition', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout imagePosition="center">Body.</SplitLayout>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      component: 'SplitLayout',
      prop: 'imagePosition'
    })
  })

  it('returns INVALID_PROP_VALUE for unsupported displayRatio', async () => {
    const result = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" displayRatio="3:1">Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      component: 'SplitLayout',
      prop: 'displayRatio'
    })
  })

  it('returns INVALID_PROP_VALUE for unsupported layoutType', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout layoutType="image-grid">Body.</SplitLayout>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      component: 'SplitLayout',
      prop: 'layoutType'
    })
  })

  it('returns DYNAMIC_EXPRESSION when imagePosition is dynamic', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout imagePosition={position}>Body.</SplitLayout>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns MISSING_REQUIRED_PROP when imageSrc needs a media resolver', async () => {
    const result = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}">Body.</SplitLayout>`,
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      component: 'SplitLayout',
      prop: 'imageSrc'
    })
  })

  it('returns UNRESOLVED_RELATION when imageSrc cannot be resolved', async () => {
    const result = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${MISSING_IMAGE_SRC}">Body.</SplitLayout>`,
      ctxWith()
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <SplitLayout> ordering
// ---------------------------------------------------------------------------

describe('SplitLayout handler — mixed content', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Intro copy.',
      '',
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}">Split body.</SplitLayout>`,
      '',
      'Outro copy.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(
      mdx,
      ctxWith({
        [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.mixedContentImage
      })
    )

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.split-layout',
      media: { image: STRAPI_UPLOAD_ID.mixedContentImage },
      content: 'Split body.'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})

describe('SplitLayout handler: intro and button group', () => {
  it('parses the intro, the button group and the 3:2 ratio', async () => {
    const blocks = await parseMdxToBlocks(
      `<SplitLayout intro={{"heading":"Heading","subheading":"Sub"}} displayRatio="3:2" imageSrc="${TEST_IMAGE_SRC}" buttons={[{"text":"Apply","link":"/apply/","style":"primary"},{"text":"More","link":"/more/","style":"secondary"}]} />`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(blocks[0]).toMatchObject({
      intro: { heading: 'Heading', subheading: 'Sub' },
      displayRatio: '3:2',
      buttons: [
        { text: 'Apply', link: '/apply/', style: 'primary' },
        { text: 'More', link: '/more/', style: 'secondary' }
      ]
    })
    expect(blocks[0]).not.toHaveProperty('content')
  })

  it('rejects an invalid button group', async () => {
    const result = await parseMdxToBlocks(
      `<SplitLayout imageSrc="${TEST_IMAGE_SRC}" buttons={[{"text":"","link":"/x/"}]}>Body.</SplitLayout>`,
      ctxWith({ [TEST_IMAGE_SRC]: STRAPI_UPLOAD_ID.primaryImage })
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'buttons'
    })
  })
})
