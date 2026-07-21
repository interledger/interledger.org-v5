import { describe, it, expect } from 'vitest'
import { serialize } from './video-embed.serializer'

describe('video-embed serializer', () => {
  it('serializes an external YouTube URL with title', () => {
    const result = serialize({
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up'
    })

    expect(result).toContain(
      'url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
    )
    expect(result).toContain('title="Never Gonna Give You Up"')
  })

  it('serializes an uploaded file (media) using the file url', () => {
    const result = serialize({
      file: { url: '/uploads/testnet_demo.mp4' },
      title: 'Testnet demo'
    })

    expect(result).toContain('url="/uploads/testnet_demo.mp4"')
    expect(result).toContain('title="Testnet demo"')
  })

  it('prefers the uploaded file url over externalUrl when both are present', () => {
    const result = serialize({
      file: { url: '/uploads/clip.mp4' },
      externalUrl: 'https://www.youtube.com/watch?v=abc',
      title: 'Test'
    })

    expect(result).toContain('url="/uploads/clip.mp4"')
  })

  it('does not throw when file is a bare upload id (validation reuse on write)', () => {
    // validateContentBlocks reuses this serializer on the raw write body, where
    // a media_library block's `file` is an unpopulated id, not { url }.
    expect(() => serialize({ file: 55, title: 'Uploaded clip' })).not.toThrow()
    expect(serialize({ file: 55, title: 'Uploaded clip' })).toContain(
      'title="Uploaded clip"'
    )
  })

  it('escapes special characters in title', () => {
    const result = serialize({
      externalUrl: 'https://www.youtube.com/watch?v=abc123',
      title: 'Q&A: "Live" Session'
    })

    expect(result).toContain('Q&amp;A: &quot;Live&quot; Session')
    expect(result).not.toContain('\\"')
  })

  it('produces a self-closing VideoEmbed tag', () => {
    const result = serialize({
      externalUrl: 'https://www.youtube.com/watch?v=abc123',
      title: 'Test'
    })

    expect(result).toMatch(/^<VideoEmbed .* \/>$/)
  })

  it('throws when neither file nor externalUrl is present', () => {
    expect(() => serialize({ title: 'Test' })).toThrow(
      'VideoEmbed block has neither file nor externalUrl'
    )
  })

  it('throws when title is missing', () => {
    expect(() =>
      serialize({
        externalUrl: 'https://www.youtube.com/watch?v=abc123',
        title: ''
      })
    ).toThrow('VideoEmbed block is missing title')
  })
})
