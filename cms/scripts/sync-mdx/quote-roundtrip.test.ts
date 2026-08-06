import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/quote.serializer'

// Side-effect import: registers Quote handler
import './quoteHandler'

const enCtx: ParserContext = {
  locale: 'en',
  resolveMediaUpload: async (url) => {
    if (url.includes('julaire')) return 42
    return null
  }
}

describe('Quote round-trip (serialize → parse)', () => {
  it('round-trips a quote with author name and link (en)', async () => {
    const original = {
      quote: 'Open payments for everyone.',
      authorName: 'Julaire Hall',
      authorLink: 'https://interledger.org'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.quote', ...original }])
  })

  it('round-trips a quote-only block', async () => {
    const original = { quote: 'Money should move like data.' }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.quote', ...original }])
  })

  it('round-trips author image via media URL', async () => {
    const mdx = serialize({
      quote: 'A networked quote.',
      authorName: 'Julaire Hall',
      authorImage: {
        url: '/img/foundation-blog/authors/julaire.jpg'
      }
    })

    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.quote',
        quote: 'A networked quote.',
        authorName: 'Julaire Hall',
        authorImage: 42
      }
    ])
  })
})
