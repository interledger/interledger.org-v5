import { describe, expect, it } from 'vitest'
import { collectSyncResults, formatProblems } from './airtableFieldValues'

describe('formatProblems', () => {
  it('puts each problem on its own line under the label', () => {
    expect(
      formatProblems('Record X', ['"Year": missing', '"Country": bad'])
    ).toBe('Record X:\n  - "Year": missing\n  - "Country": bad')
  })
})

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
