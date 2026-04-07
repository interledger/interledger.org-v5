import { describe, it, expect } from 'vitest'
import { serialize } from './paragraph.serializer'

describe('paragraph serializer', () => {
  it('serializes plain content', () => {
    const result = serialize({ content: 'Hello world.' })
    expect(result).toBe('<Paragraph>\n\nHello world.\n\n</Paragraph>')
  })

  it('adds alignment attribute when not left', () => {
    const result = serialize({ content: 'Centered.', alignment: 'center' })
    expect(result).toContain('alignment="center"')
  })

  it('omits alignment attribute for left alignment', () => {
    const result = serialize({ content: 'Left.', alignment: 'left' })
    expect(result).not.toContain('alignment=')
  })

  it('strips Strapi host from inline image URLs', () => {
    const result = serialize({
      content:
        'See ![chart](http://localhost:1337/uploads/img/original/chart.png) here.'
    })
    expect(result).toContain('/uploads/img/original/chart.png')
    expect(result).not.toContain('http://localhost:1337')
  })

  it('strips https host from inline image URLs', () => {
    const result = serialize({
      content:
        '![img](https://cms.example.com/uploads/img/original/foo.png)'
    })
    expect(result).toContain('/uploads/img/original/foo.png')
    expect(result).not.toContain('https://cms.example.com')
  })
})
