import { describe, it, expect } from 'vitest'
import { validateNoNestedJsx } from './contentValidation'

describe('validateNoNestedJsx', () => {
  it('throws when a paragraph block contains bare JSX', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content:
          'Some text\n\n<Blockquote source="Someone">Smart quote</Blockquote>'
      }
    ]

    expect(() => validateNoNestedJsx(content)).toThrow('<Blockquote>')
  })

  it('does not throw for plain markdown content', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: '## Heading\n\nSome **bold** text.'
      }
    ]

    expect(() => validateNoNestedJsx(content)).not.toThrow()
  })

  it('ignores JSX inside fenced code blocks', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: [
          'Some text.',
          '',
          '```jsx',
          '<Blockquote source="Someone">example</Blockquote>',
          '```'
        ].join('\n')
      }
    ]

    expect(() => validateNoNestedJsx(content)).not.toThrow()
  })

  it('ignores non-paragraph blocks', () => {
    const content = [
      {
        __component: 'blocks.blockquote',
        content: '<CalloutText content="nested" />'
      }
    ]

    expect(() => validateNoNestedJsx(content)).not.toThrow()
  })

  it('does nothing for non-array input', () => {
    expect(() => validateNoNestedJsx(undefined)).not.toThrow()
    expect(() => validateNoNestedJsx('raw string')).not.toThrow()
    expect(() => validateNoNestedJsx(null)).not.toThrow()
  })
})
