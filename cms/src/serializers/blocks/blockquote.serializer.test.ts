import { describe, it, expect } from 'vitest'
import { serialize } from './blockquote.serializer'

describe('blockquote serializer', () => {
  it('serializes blockquote with quote and source', () => {
    const result = serialize({
      quote: 'The Internet is for everyone.',
      source: 'Vint Cerf'
    })

    expect(result).toContain('<Blockquote source="Vint Cerf">')
    expect(result).toContain('</Blockquote>')
    expect(result).toContain('Internet is for everyone')
  })

  it('serializes blockquote without source', () => {
    const result = serialize({ quote: 'A simple quote.' })

    expect(result).not.toContain('source=')
    expect(result).toContain('<Blockquote>')
    expect(result).toContain('simple quote')
  })

  it('escapes braces in quote content', () => {
    const result = serialize({ quote: 'Use {templates} wisely.' })

    expect(result).toContain('\\{')
    expect(result).toContain('\\}')
  })

  it('serializes Spanish content identically', () => {
    const result = serialize({
      quote: 'La Internet es para todos.',
      source: 'Vint Cerf'
    })

    expect(result).toContain('<Blockquote source="Vint Cerf">')
    expect(result).toContain('La Internet es para todos')
    expect(result).toContain('</Blockquote>')
  })
})
