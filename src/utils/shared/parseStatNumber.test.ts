import { describe, expect, it } from 'vitest'
import { formatStatNumber, parseStatNumber } from './parseStatNumber'

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

describe('formatStatNumber', () => {
  it('adds grouping commas', () => {
    expect(formatStatNumber(1000)).toBe('1,000')
    expect(formatStatNumber(21000000)).toBe('21,000,000')
  })

  it('leaves small numbers ungrouped', () => {
    expect(formatStatNumber(21)).toBe('21')
    expect(formatStatNumber(0)).toBe('0')
  })
})
