import { describe, it, expect } from 'vitest'
import { validateNoNestedJsx } from '@/utils'

describe('validateNoNestedJsx', () => {
  it('returns a ValidationError when a paragraph block contains bare JSX', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content:
          'Some text\n\n<Blockquote source="Someone">Smart quote</Blockquote>'
      }
    ]

    const err = validateNoNestedJsx(content)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain('<Blockquote>')
  })

  it('returns undefined for plain markdown content', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: '## Heading\n\nSome **bold** text.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
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

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores a standalone multi-line fenced block', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: [
          '```tsx',
          '<ProfileCard name="A" />',
          '<CalloutText>note</CalloutText>',
          '```'
        ].join('\n')
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores JSX inside inline code spans (INTORG-793)', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content:
          'Use the `<WalletAddress />` component and the `<Blockquote>` tag inline.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores JSX inside double-backtick inline code', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: 'Render ``<CalloutText prop="`x`" />`` literally.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('still flags bare JSX even when other JSX is in inline code', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: 'Inline `<Safe />` is fine but <Blockquote> is not.'
      }
    ]

    const err = validateNoNestedJsx(content)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain('<Blockquote>')
  })

  it('ignores non-paragraph blocks', () => {
    const content = [
      {
        __component: 'blocks.blockquote',
        content: '<CalloutText content="nested" />'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('returns undefined for non-array input', () => {
    expect(validateNoNestedJsx(undefined)).toBeUndefined()
    expect(validateNoNestedJsx('raw string')).toBeUndefined()
    expect(validateNoNestedJsx(null)).toBeUndefined()
  })
})
