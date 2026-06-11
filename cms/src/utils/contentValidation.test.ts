import { describe, it, expect } from 'vitest'
import { validateNoNestedJsx, validateArticleBioAuthors } from '@/utils'

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

describe('validateArticleBioAuthors', () => {
  it('returns a ValidationError when a bio has no author', () => {
    const err = validateArticleBioAuthors([{ author: null }])
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain('author')
  })

  it('flags empty and whitespace-only authors', () => {
    expect(validateArticleBioAuthors([{ author: '' }])).toBeInstanceOf(Error)
    expect(validateArticleBioAuthors([{ author: '   ' }])).toBeInstanceOf(Error)
  })

  it('flags a bio with a link but no author', () => {
    const err = validateArticleBioAuthors([
      { author: '', link: 'https://example.com' }
    ])
    expect(err).toBeInstanceOf(Error)
  })

  it('flags when any bio in the list is authorless', () => {
    const err = validateArticleBioAuthors([
      { author: 'Jane Doe' },
      { author: null }
    ])
    expect(err).toBeInstanceOf(Error)
  })

  it('returns undefined when every bio has an author', () => {
    expect(
      validateArticleBioAuthors([
        { author: 'Jane Doe', link: 'https://example.com' },
        { author: 'John Roe' }
      ])
    ).toBeUndefined()
  })

  it('returns undefined for an empty list or non-array input', () => {
    expect(validateArticleBioAuthors([])).toBeUndefined()
    expect(validateArticleBioAuthors(undefined)).toBeUndefined()
    expect(validateArticleBioAuthors(null)).toBeUndefined()
  })
})
