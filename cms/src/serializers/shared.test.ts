import { describe, it, expect } from 'vitest'
import { escDouble, escSingle, escMdxBraces, unescapeMdxBraces } from './shared'

describe('escDouble', () => {
  it('encodes characters that break double-quoted JSX attributes', () => {
    expect(escDouble('Q&A: "Live" <Session>')).toBe(
      'Q&amp;A: &quot;Live&quot; &lt;Session&gt;'
    )
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
  it('encodes single quotes and shared attr-breaking characters', () => {
    expect(escSingle('it\'s <ok> & "fine"')).toBe(
      'it&#39;s &lt;ok&gt; &amp; "fine"'
    )
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
