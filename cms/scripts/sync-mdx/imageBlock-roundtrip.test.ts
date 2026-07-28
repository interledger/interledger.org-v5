import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/image-block.serializer'

// Side-effect import: registers the ImageBlock handler
import './imageBlockHandler'

/**
 * Round-trip is serialize (Strapi media objects → MDX) then parse (MDX →
 * resolved media IDs). The parser resolves each src back to the id the
 * resolver map assigns, so the assertions use ids rather than urls.
 */
function ctxWith(uploads: Record<string, number>): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) throw new Error(`Upload "${url}" not found.`)
      return id
    }
  }
}

describe('ImageBlock round-trip (serialize → parse)', () => {
  it('round-trips a plain image with alt text', async () => {
    const original = {
      image: { url: '/img/diagram.png', alternativeText: 'A diagram' }
    }
    const blocks = await parseMdxToBlocks(
      serialize(original),
      ctxWith({ '/img/diagram.png': 10 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.image-block',
        image: 10,
        altText: 'A diagram',
        needsFullView: false,
        needsOutline: false
      }
    ])
  })

  it('round-trips needsFullView and needsOutline flags', async () => {
    const original = {
      image: { url: '/img/diagram.png', alternativeText: 'A diagram' },
      needsFullView: true,
      needsOutline: true
    }
    const blocks = await parseMdxToBlocks(
      serialize(original),
      ctxWith({ '/img/diagram.png': 10 })
    )

    expect(blocks[0]).toMatchObject({
      image: 10,
      needsFullView: true,
      needsOutline: true
    })
  })

  it('round-trips responsive tablet and mobile variants', async () => {
    const original = {
      image: { url: '/img/desktop.png' },
      tabletImage: { url: '/img/tablet.png' },
      mobileImage: { url: '/img/mobile.png' }
    }
    const blocks = await parseMdxToBlocks(
      serialize(original),
      ctxWith({
        '/img/desktop.png': 1,
        '/img/tablet.png': 2,
        '/img/mobile.png': 3
      })
    )

    expect(blocks[0]).toMatchObject({
      image: 1,
      tabletImage: 2,
      mobileImage: 3
    })
  })

  it('matches the shape the migrated posts use (needsFullView diagram)', async () => {
    const original = {
      image: {
        url: '/img/foundation-blog/2024-07-30/oauth-sequence-diagram.png',
        alternativeText: 'The OAuth 2.0 Sequence Diagram'
      },
      needsFullView: true
    }
    const blocks = await parseMdxToBlocks(
      serialize(original),
      ctxWith({
        '/img/foundation-blog/2024-07-30/oauth-sequence-diagram.png': 422
      })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.image-block',
        image: 422,
        altText: 'The OAuth 2.0 Sequence Diagram',
        needsFullView: true,
        needsOutline: false
      }
    ])
  })
})
