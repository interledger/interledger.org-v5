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
    expect(result).toContain('The Internet is for everyone.')
    // Marks are CSS/component-owned — do not embed literal curly quotes
    expect(result).not.toMatch(/[“”]/)
  })

  it('serializes blockquote without source', () => {
    const result = serialize({ quote: 'A simple quote.' })

    expect(result).not.toContain('source=')
    expect(result).toContain('<Blockquote>')
    expect(result).toContain('A simple quote.')
    expect(result).not.toMatch(/[“”]/)
  })

  it('strips surrounding quotes from CMS text on export', () => {
    const result = serialize({
      quote: '“Money should move like data.”',
      source: 'Author'
    })

    expect(result).toContain('Money should move like data.')
    expect(result).not.toMatch(/[“”]/)
  })

  it('escapes braces in quote content', () => {
    const result = serialize({ quote: 'Use {templates} wisely.' })

    expect(result).toContain('\\{')
    expect(result).toContain('\\}')
  })

  it('converts a CKEditor <br>/<br><br> in source to \\n/\\n\\n (entity-encoded in the attribute)', () => {
    const result = serialize({
      quote: 'A simple thought.',
      source: 'One<br />Two<br /><br />Three'
    })

    expect(result).toContain('source="One&#10;Two&#10;&#10;Three"')
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
