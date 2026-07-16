import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/video-embed.serializer'

// Side-effect import: registers the VideoEmbed handler
import './videoEmbedHandler'

/**
 * Round-trip is serialize (Strapi media object / externalUrl → MDX) then parse
 * (MDX → resolved shape). External URLs stay strings; uploaded files resolve to
 * the id the resolver map assigns.
 */
function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) throw new Error(`Upload "${url}" not found.`)
      return id
    }
  }
}

describe('VideoEmbed round-trip (serialize → parse)', () => {
  it('round-trips an external YouTube URL', async () => {
    const original = {
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'A talk'
    }
    const blocks = await parseMdxToBlocks(serialize(original), { locale: 'en' })

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        source: 'external_url',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'A talk'
      }
    ])
  })

  it('round-trips an uploaded file (media → url → resolved id)', async () => {
    const original = {
      file: { url: '/uploads/testnet_demo.mp4' },
      title: 'Testnet demo'
    }
    const blocks = await parseMdxToBlocks(
      serialize(original),
      ctxWith({ '/uploads/testnet_demo.mp4': 55 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        source: 'media_library',
        file: 55,
        title: 'Testnet demo'
      }
    ])
  })
})
