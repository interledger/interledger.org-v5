import { describe, expect, it } from 'vitest'
import { createExcerpt } from '../../src/utils/create-excerpt.js'

describe('createExcerpt', () => {
  it('converts markdown to plain text', () => {
    const input = '# Title\n\nThis is **bold** and a [link](https://example.com).'
    const output = createExcerpt(input)
    expect(output).toContain('Title')
    expect(output).toContain('This is bold and a link.')
  })

  it('handles non-string inputs safely', () => {
    const output = createExcerpt(null)
    expect(output).toBe('')
  })
})
