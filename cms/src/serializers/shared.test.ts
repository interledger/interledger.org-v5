import { describe, it, expect } from 'vitest'
import { escDouble, escSingle, escMdxBraces, unescapeMdxBraces } from './shared'

describe('escDouble', () => {
  it('encodes the double quote that would close the attribute early', () => {
    expect(escDouble('Q&A: "Live" <Session>')).toBe(
      'Q&A: &quot;Live&quot; <Session>'
    )
  })

  it('leaves a bare ampersand alone, including in a query string', () => {
    expect(escDouble('https://youtube.com/watch?v=abc&list=xyz')).toBe(
      'https://youtube.com/watch?v=abc&list=xyz'
    )
    expect(escDouble('Prizes & Judging')).toBe('Prizes & Judging')
  })

  it('escapes an ampersand that starts a character reference, so it survives the round trip', () => {
    expect(escDouble('literal &amp; here')).toBe('literal &amp;amp; here')
    expect(escDouble('literal &#39; here')).toBe('literal &amp;#39; here')
    expect(escDouble('literal &#x27; here')).toBe('literal &amp;#x27; here')
  })

  it('leaves an ampersand whose semicolon is a sentence apart alone', () => {
    expect(escDouble('a & b; c')).toBe('a & b; c')
  })

  it('encodes newlines as &#10; so multi-line Strapi text stays single-line in MDX attrs', () => {
    expect(escDouble('Line 1\nLine 2')).toBe('Line 1&#10;Line 2')
    expect(escDouble('Line 1\r\nLine 2')).toBe('Line 1&#10;Line 2')
    expect(escDouble('Line 1\rLine 2')).toBe('Line 1&#10;Line 2')
  })

  it('does not leave raw newlines in the escaped value', () => {
    expect(escDouble('a\nb\rc\r\nd')).not.toMatch(/[\r\n]/)
  })

  it('returns empty string for empty input', () => {
    expect(escDouble('')).toBe('')
  })
})

describe('escSingle', () => {
  it('encodes the single quote that would close the attribute early', () => {
    expect(escSingle('it\'s <ok> & "fine"')).toBe('it&#39;s <ok> & "fine"')
  })

  it('encodes newlines as &#10; (shared with escDouble)', () => {
    expect(escSingle('a\nb')).toBe('a&#10;b')
  })
})

describe('escMdxBraces', () => {
  it('escapes curly braces for MDX body text', () => {
    expect(escMdxBraces(' use {tokens} ')).toBe('use \\{tokens\\}')
  })
})

describe('unescapeMdxBraces', () => {
  it('reverses escMdxBraces', () => {
    const escaped = escMdxBraces('use {tokens} wisely')
    expect(unescapeMdxBraces(escaped)).toBe('use {tokens} wisely')
  })

  it('only strips one backslash layer, so it undoes exactly one escMdxBraces pass', () => {
    expect(unescapeMdxBraces('use \\\\{tokens\\\\} wisely')).toBe(
      'use \\{tokens\\} wisely'
    )
  })

  it('leaves text without brace escapes untouched', () => {
    expect(unescapeMdxBraces('See the [grant overview](/grant).')).toBe(
      'See the [grant overview](/grant).'
    )
  })
})
