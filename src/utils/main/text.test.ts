import { describe, expect, it } from 'vitest'
import { truncateText } from './text'

describe('truncateText', () => {
  it('returns the original string when it already fits', () => {
    expect(truncateText('short', 160)).toBe('short')
  })

  it('never exceeds maxLength including the ellipsis', () => {
    const text = 'Building open payments infrastructure for everyone. '.repeat(
      8
    )
    const result = truncateText(text, 160)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.endsWith('…')).toBe(true)
  })

  it('cuts back to a word boundary', () => {
    const result = truncateText('one two three four five six seven', 20)
    expect(result.length).toBeLessThanOrEqual(20)
    expect(result).toMatch(/ …$/)
    expect(result).not.toContain('seven')
  })
})
