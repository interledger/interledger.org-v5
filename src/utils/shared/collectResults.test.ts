import { describe, expect, it } from 'vitest'
import { collectResults } from './collectResults'

describe('collectResults', () => {
  it('returns every value, in order, when nothing failed', () => {
    expect(collectResults([['a'], 2, { c: true }])).toEqual([
      ['a'],
      2,
      { c: true }
    ])
  })

  it('returns one error with every failure, in order', () => {
    const result = collectResults([
      new Error('Directory: bad record'),
      ['report'],
      new Error('Profiles: bad slug')
    ])
    expect(result).toBeInstanceOf(Error)
    expect(result instanceof Error && result.message).toBe(
      'Directory: bad record\n\nProfiles: bad slug'
    )
  })
})
