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

  it('strips Strapi host from inline image URLs', () => {
    const result = serialize({
      content:
        'See ![diagram](http://localhost:1337/uploads/img/original/diagram.png) above.'
    })

    expect(result).toContain('/uploads/img/original/diagram.png')
    expect(result).not.toContain('http://localhost:1337')
  })
})
