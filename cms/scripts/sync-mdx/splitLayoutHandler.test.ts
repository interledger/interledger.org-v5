import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers SplitLayout handler
import './splitLayoutHandler'

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
      '<SplitLayout imageSrc="/img/foo.jpg" imageAlt="Foo alt" imagePosition="left" ctaText="Apply" ctaLink="https://example.com" ctaExternal={true}>',
      '',
      'Some **body** copy.',
      '',
      '</SplitLayout>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith({ '/img/foo.jpg': 42 }))

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'left',
        image: 42,
        imageAlt: 'Foo alt',
        content: 'Some **body** copy.',
        cta: {
          text: 'Apply',
          link: 'https://example.com',
          external: true
        }
      }
    ])
  })

  it('defaults imagePosition to right and omits optional fields when absent', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout imageSrc="/img/foo.jpg">Body.</SplitLayout>',
      ctxWith({ '/img/foo.jpg': 7 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'right',
        image: 7,
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
        videoUrl: 'https://vimeo.com/123',
        quote: 'Open payments matter.',
        quoteSource: 'Interledger'
      }
    ])
  })

  it('parses CTA style when provided', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout imageSrc="/img/foo.jpg" ctaText="Learn" ctaLink="/learn" ctaStyle="secondary">Body.</SplitLayout>',
      ctxWith({ '/img/foo.jpg': 42 })
    )

    expect(blocks[0]).toMatchObject({
      cta: {
        text: 'Learn',
        link: '/learn',
        style: 'secondary'
      }
    })
  })

  it('uses layoutType to ignore stale quote attributes for text layouts', async () => {
    const blocks = await parseMdxToBlocks(
      '<SplitLayout layoutType="image-text" imageSrc="/img/foo.jpg" imageAlt="Scoped alt" quote="Stale quote" quoteSource="Stale source">Body.</SplitLayout>',
      ctxWith({ '/img/foo.jpg': 11 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        imagePosition: 'right',
        image: 11,
        imageAlt: 'Scoped alt',
        content: 'Body.'
      }
    ])
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

  it('returns DYNAMIC_EXPRESSION when ctaExternal is dynamic', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout ctaText="Apply" ctaLink="/apply" ctaExternal={isExternal}>Body.</SplitLayout>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns MISSING_REQUIRED_PROP when imageSrc needs a media resolver', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout imageSrc="/img/foo.jpg">Body.</SplitLayout>',
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
      '<SplitLayout imageSrc="/img/missing.jpg">Body.</SplitLayout>',
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
      '<SplitLayout imageSrc="/img/foo.jpg">Split body.</SplitLayout>',
      '',
      'Outro copy.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith({ '/img/foo.jpg': 3 }))

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.split-layout',
      image: 3,
      content: 'Split body.'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
