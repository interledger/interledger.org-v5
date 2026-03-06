import { describe, it, expect } from 'vitest'
import { serialize } from './callout-text.serializer'

describe('callout-text serializer', () => {
  it('serializes callout-text with content', () => {
    const result = serialize({ content: 'Important information.' })

    expect(result).toBe('<CalloutText>\nImportant information.\n</CalloutText>')
  })

  it('converts HTML content to markdown', () => {
    const result = serialize({
      content: '<p>Hello <strong>world</strong></p>'
    })

    expect(result).toContain('**world**')
    expect(result).not.toContain('<strong>')
  })

  it('escapes braces in content', () => {
    const result = serialize({ content: 'Use {expressions} carefully.' })

    expect(result).toContain('\\{expressions\\}')
  })

  it('returns empty string for empty content', () => {
    expect(serialize({ content: '' })).toBe('')
  })

  it('serializes Spanish content identically', () => {
    const result = serialize({ content: 'Informacion importante.' })

    expect(result).toContain('<CalloutText>')
    expect(result).toContain('Informacion importante.')
    expect(result).toContain('</CalloutText>')
  })
})
