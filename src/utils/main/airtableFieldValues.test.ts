import { describe, expect, it } from 'vitest'
import { collectSyncResults } from './airtableFieldValues'

describe('collectSyncResults', () => {
  it('returns every value, in order, when no part failed', () => {
    expect(collectSyncResults([['a'], 2, { c: true }])).toEqual([
      ['a'],
      2,
      { c: true }
    ])
  })

  it('returns one error with every failed part, in order', () => {
    const result = collectSyncResults([
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
