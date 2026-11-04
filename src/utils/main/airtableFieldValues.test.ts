import { describe, expect, it } from 'vitest'
import {
  collectSyncResults,
  formatProblems,
  partitionRecordResults,
  recordProblemsError
} from './airtableFieldValues'

describe('formatProblems', () => {
  it('puts each problem on its own line under the label', () => {
    expect(
      formatProblems('Record X', ['"Year": missing', '"Country": bad'])
    ).toBe('Record X:\n  - "Year": missing\n  - "Country": bad')
  })
})

describe('partitionRecordResults', () => {
  it('splits values from error messages, keeping the order of each', () => {
    expect(
      partitionRecordResults(['a', new Error('bad 1'), 'b', new Error('bad 2')])
    ).toEqual({ values: ['a', 'b'], problems: ['bad 1', 'bad 2'] })
  })

  it('returns empty lists for no results', () => {
    expect(partitionRecordResults([])).toEqual({ values: [], problems: [] })
  })
})

describe('recordProblemsError', () => {
  it('counts the entries under the label and puts each on its own line', () => {
    const problems = ['Record A:\n  - x\n  - y', 'Record B:\n  - z']
    expect(
      recordProblemsError(problems, 'record(s) cannot be published').message
    ).toBe(
      '2 record(s) cannot be published:\nRecord A:\n  - x\n  - y\nRecord B:\n  - z'
    )
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
