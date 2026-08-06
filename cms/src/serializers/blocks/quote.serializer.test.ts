import { describe, it, expect } from 'vitest'
import { serialize } from './quote.serializer'

describe('quote serializer', () => {
  it('serializes a quote with full author attribution', () => {
    const result = serialize({
      quote: 'Open payments for everyone.',
      authorName: 'Julaire Hall',
      authorImage: { url: '/img/foundation-blog/authors/julaire.jpg' },
      authorLink: 'https://interledger.org'
    })

    expect(result).toContain('authorName="Julaire Hall"')
    expect(result).toContain(
      'authorImage="/img/foundation-blog/authors/julaire.jpg"'
    )
    expect(result).toContain('authorLink="https://interledger.org"')
    expect(result).toContain('Open payments for everyone.')
  })

  it('serializes a quote with no author fields', () => {
    expect(serialize({ quote: 'Just the words.' })).toBe(
      '<Quote>\n  Just the words.\n</Quote>'
    )
  })

  it('throws when quote text is missing', () => {
    expect(() => serialize({})).toThrow(/missing quote text/)
    expect(() => serialize({ quote: '   ' })).toThrow(/missing quote text/)
  })

  it('escapes braces in the quote body', () => {
    const result = serialize({ quote: 'Use {tokens} carefully.' })
    expect(result).toContain('\\{tokens\\}')
  })
})
