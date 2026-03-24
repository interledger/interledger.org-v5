import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

// Side-effect import: registers VideoEmbed handler
import './videoEmbedHandler'

const ctx = { locale: 'en' }

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('VideoEmbed handler', () => {
  it('parses YouTube URL with title', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Never Gonna Give You Up" />',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up'
      }
    ])
  })

  it('parses Vimeo URL with title', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://vimeo.com/123456789" title="Sample Video" />',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.video-embed',
        url: 'https://vimeo.com/123456789',
        title: 'Sample Video'
      }
    ])
  })

  it('parses youtu.be short URL', async () => {
    const blocks = await parseMdxToBlocks(
      '<VideoEmbed url="https://youtu.be/N5BTy2xxRqQ" title="Short URL" />',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      url: 'https://youtu.be/N5BTy2xxRqQ',
      title: 'Short URL'
    })
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('VideoEmbed handler — errors', () => {
  it('throws MISSING_REQUIRED_PROP when url is missing', async () => {
    await expect(
      parseMdxToBlocks('<VideoEmbed title="No URL" />', ctx)
    ).rejects.toMatchObject({ code: ParserErrorCode.MISSING_REQUIRED_PROP })
  })

  it('throws MISSING_REQUIRED_PROP when title is missing', async () => {
    await expect(
      parseMdxToBlocks(
        '<VideoEmbed url="https://www.youtube.com/watch?v=abc" />',
        ctx
      )
    ).rejects.toMatchObject({ code: ParserErrorCode.MISSING_REQUIRED_PROP })
  })

  it('throws DYNAMIC_EXPRESSION when url is a dynamic expression', async () => {
    await expect(
      parseMdxToBlocks('<VideoEmbed url={someVar} title="Test" />', ctx)
    ).rejects.toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('throws DYNAMIC_EXPRESSION when title is a dynamic expression', async () => {
    await expect(
      parseMdxToBlocks(
        '<VideoEmbed url="https://youtube.com/watch?v=abc" title={someVar} />',
        ctx
      )
    ).rejects.toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
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
      url: 'https://www.youtube.com/watch?v=ATO1d9PfD0g',
      title: 'Hackathon Recording'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
