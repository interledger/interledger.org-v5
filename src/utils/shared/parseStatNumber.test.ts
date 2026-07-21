import { describe, expect, it } from 'vitest'
import { parseStatNumber } from './parseStatNumber'

describe('parseStatNumber', () => {
  it('parses plain digits', () => {
    expect(parseStatNumber('21')).toBe(21)
  })

  it('strips commas before parsing', () => {
    expect(parseStatNumber('1,000')).toBe(1000)
    expect(parseStatNumber('21,000,000')).toBe(21000000)
  })

  it('returns null for non-numeric text', () => {
    expect(parseStatNumber('Coming soon')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseStatNumber('')).toBeNull()
  })

  it('returns null for a whitespace-only string', () => {
    expect(parseStatNumber('   ')).toBeNull()
  })
})
