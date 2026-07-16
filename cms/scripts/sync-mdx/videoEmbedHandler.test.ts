import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers VideoEmbed handler
import './videoEmbedHandler'

const ctx: ParserContext = { locale: 'en' }

/** Build a ParserContext with a controllable resolveMediaUpload. */
function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message: `Upload "${url}" not found.`,
          component: 'VideoEmbed'
        })
      }
      return id
    }
  }
}

// ---------------------------------------------------------------------------
// External URLs (youtube / vimeo / direct file URL) → source: external_url
// ---------------------------------------------------------------------------

describe('VideoEmbed handler — external URLs', () => {
  it('stores a YouTube URL in externalUrl', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Never Gonna Give You Up" />',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        source: 'external_url',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up'
      }
    ])
  })

  it('stores a Vimeo URL in externalUrl', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://vimeo.com/123456789" title="Sample Video" />',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      source: 'external_url',
      externalUrl: 'https://vimeo.com/123456789'
    })
  })

  it('stores an external direct file URL in externalUrl', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://cdn.example.com/clip.mp4" title="Clip" />',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      source: 'external_url',
      externalUrl: 'https://cdn.example.com/clip.mp4'
    })
    expect(blocks[0]).not.toHaveProperty('file')
  })
})

// ---------------------------------------------------------------------------
// Internal paths (uploaded / seeded) → source: media_library
// ---------------------------------------------------------------------------

describe('VideoEmbed handler — uploaded / internal files', () => {
  it('resolves a /uploads path to a Strapi file ID', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="/uploads/clip.mp4" title="Uploaded clip" />',
      ctxWith({ '/uploads/clip.mp4': 42 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        source: 'media_library',
        file: 42,
        title: 'Uploaded clip'
      }
    ])
  })

  it('treats a repo /img video path as an external URL (not a Strapi upload)', async () => {
    // Bootstrap seeds only image extensions into media, so a repo /img/*.mp4
    // is a plain URL string, not a media entity.
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="/img/foundation-blog/2024-10-11/hover-effect.mp4" title="Hover effect demo" />',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      source: 'external_url',
      externalUrl: '/img/foundation-blog/2024-10-11/hover-effect.mp4'
    })
    expect(blocks[0]).not.toHaveProperty('file')
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('VideoEmbed handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when url is missing', async () => {
    const result = await parseMdxToBlocks('<VideoEmbed title="No URL" />', ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when title is missing', async () => {
    const result = await parseMdxToBlocks(
      '<VideoEmbed url="https://www.youtube.com/watch?v=abc" />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns DYNAMIC_EXPRESSION when url is a dynamic expression', async () => {
    const result = await parseMdxToBlocks(
      '<VideoEmbed url={someVar} title="Test" />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns UNRESOLVED_RELATION when an internal file is not in Strapi media', async () => {
    const result = await parseMdxToBlocks(
      '<VideoEmbed url="/uploads/missing.mp4" title="Test" />',
      ctxWith({})
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })

  it('returns UNRESOLVED_RELATION when resolveMediaUpload is absent for an internal file', async () => {
    const result = await parseMdxToBlocks(
      '<VideoEmbed url="/uploads/clip.mp4" title="Test" />',
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <VideoEmbed> ordering
// ---------------------------------------------------------------------------

describe('VideoEmbed handler — mixed content', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Watch the recording below:',
      '',
      '<VideoEmbed url="https://www.youtube.com/watch?v=ATO1d9PfD0g" title="Hackathon Recording" />',
      '',
      'More content after the video.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toEqual({
      __component: 'blocks.video-embed',
      source: 'external_url',
      externalUrl: 'https://www.youtube.com/watch?v=ATO1d9PfD0g',
      title: 'Hackathon Recording'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
