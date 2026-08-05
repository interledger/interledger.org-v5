import { describe, it, expect } from 'vitest'
import { serialize } from './faq.serializer'
import { SerializerFieldError } from '@/utils'

const validItem = {
  question: 'What is the Interledger Foundation?',
  answer: 'A private operating foundation.'
}

describe('faq serializer', () => {
  it('serializes a block with a heading and a single question', () => {
    const result = serialize({ heading: 'About us', items: [validItem] })

    expect(result).toContain('<Faq heading="About us">')
    expect(result).toContain(
      '<FaqItem question="What is the Interledger Foundation?">'
    )
    expect(result).toContain('A private operating foundation.')
    expect(result).toContain('</FaqItem>')
    expect(result).toContain('</Faq>')
  })

  it('omits the heading attribute when the heading is absent', () => {
    const result = serialize({ items: [validItem] })

    expect(result).toContain('<Faq>')
    expect(result).not.toContain('heading=')
  })

  it('omits the heading attribute when the heading is only whitespace', () => {
    const result = serialize({ heading: '   ', items: [validItem] })

    expect(result).toContain('<Faq>')
    expect(result).not.toContain('heading=')
  })

  it('serializes multiple questions in order', () => {
    const result = serialize({
      items: [
        { ...validItem, question: 'First' },
        { ...validItem, question: 'Second' }
      ]
    })

    expect(result.indexOf('First')).toBeLessThan(result.indexOf('Second'))
  })

  it('escapes characters that would break a JSX attribute', () => {
    const result = serialize({
      heading: 'A & B',
      items: [{ ...validItem, question: 'Is it "free" & <open>?' }]
    })

    expect(result).toContain('heading="A &amp; B"')
    expect(result).toContain(
      'question="Is it &quot;free&quot; &amp; &lt;open&gt;?"'
    )
  })

  it('escapes MDX braces in the answer', () => {
    const result = serialize({
      items: [{ ...validItem, answer: 'Use {tokens} wisely.' }]
    })

    expect(result).toContain('\\{tokens\\}')
  })

  it('converts an HTML answer to markdown', () => {
    const result = serialize({
      items: [{ ...validItem, answer: '<p>Hello <strong>world</strong></p>' }]
    })

    expect(result).toContain('**world**')
    expect(result).not.toContain('<strong>')
  })

  it('throws when there are no questions', () => {
    expect(() => serialize({ heading: 'About us', items: [] })).toThrow(
      SerializerFieldError
    )
    expect(() => serialize({ heading: 'About us' })).toThrow(
      SerializerFieldError
    )
  })

  it('reports every missing field across every question at once', () => {
    let caught: SerializerFieldError | undefined
    try {
      serialize({
        items: [
          { question: '  ', answer: '' },
          { question: 'Fine', answer: '   ' }
        ]
      })
    } catch (error) {
      caught = error as SerializerFieldError
    }

    expect(caught).toBeInstanceOf(SerializerFieldError)
    expect(caught?.fieldErrors).toEqual([
      expect.objectContaining({ path: ['items', 0, 'question'] }),
      expect.objectContaining({ path: ['items', 0, 'answer'] }),
      expect.objectContaining({ path: ['items', 1, 'answer'] })
    ])
  })
})
