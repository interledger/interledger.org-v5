import { describe, it, expect } from 'vitest'
import { serialize } from './video-embed.serializer'

describe('video-embed serializer', () => {
  it('serializes a YouTube URL with title', () => {
    const result = serialize({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up'
    })

    expect(result).toContain(
      'url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
    )
    expect(result).toContain('title="Never Gonna Give You Up"')
  })

  it('serializes a Vimeo URL with title', () => {
    const result = serialize({
      url: 'https://vimeo.com/123456789',
      title: 'Sample Vimeo Video'
    })

    expect(result).toContain('url="https://vimeo.com/123456789"')
    expect(result).toContain('title="Sample Vimeo Video"')
  })

  it('escapes special characters in title', () => {
    const result = serialize({
      url: 'https://www.youtube.com/watch?v=abc123',
      title: 'Q&A: "Live" Session'
    })

    expect(result).toContain('Q&A: \\"Live\\" Session')
  })

  it('produces a self-closing VideoEmbed tag', () => {
    const result = serialize({
      url: 'https://www.youtube.com/watch?v=abc123',
      title: 'Test'
    })

    expect(result).toMatch(/^<VideoEmbed .* \/>$/)
  })

  it('throws when url is missing', () => {
    expect(() => serialize({ url: '', title: 'Test' })).toThrow(
      'VideoEmbed block is missing url'
    )
  })

  it('throws when title is missing', () => {
    expect(() =>
      serialize({ url: 'https://www.youtube.com/watch?v=abc123', title: '' })
    ).toThrow('VideoEmbed block is missing title')
  })
})
