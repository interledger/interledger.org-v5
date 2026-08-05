import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers Quote handler
import './quoteHandler'

const ctx: ParserContext = {
  locale: 'en',
  resolveMediaUpload: async (url) => {
    if (url === '/img/foundation-blog/authors/julaire.jpg') return 42
    return null
  }
}

describe('Quote handler', () => {
  it('parses a quote with full author attribution', async () => {
    const mdx = [
      '<Quote authorName="Julaire Hall" authorImage="/img/foundation-blog/authors/julaire.jpg" authorLink="https://interledger.org">',
      'Sending value across the internet should be as seamless as sending an email.',
      '</Quote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.quote',
        quote:
          'Sending value across the internet should be as seamless as sending an email.',
        authorName: 'Julaire Hall',
        authorImage: 42,
        authorLink: 'https://interledger.org'
      }
    ])
  })

  it('parses a quote with only text', async () => {
    const blocks = await parseMdxToBlocks(
      '<Quote>Open payments for everyone.</Quote>',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.quote',
        quote: 'Open payments for everyone.'
      }
    ])
  })

  it('parses a quote with author name only', async () => {
    const blocks = await parseMdxToBlocks(
      '<Quote authorName="Stefan Thomas">Interledger connects payment networks.</Quote>',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.quote',
        quote: 'Interledger connects payment networks.',
        authorName: 'Stefan Thomas'
      }
    ])
  })

  it('returns INVALID_PROP_VALUE when quote children are empty', async () => {
    const result = await parseMdxToBlocks('<Quote authorName="Someone" />', ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'children'
    })
  })

  it('returns UNRESOLVED_RELATION when authorImage is set without a media resolver', async () => {
    const result = await parseMdxToBlocks(
      '<Quote authorImage="/img/foo.jpg">A quote.</Quote>',
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      prop: 'authorImage'
    })
  })
})
