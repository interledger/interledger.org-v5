import { describe, expect, it } from 'vitest'
import {
  formatProblems,
  isRecordId,
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

describe('isRecordId', () => {
  it('accepts an Airtable record ID', () => {
    expect(isRecordId('recUSF6jZiBVoqG01')).toBe(true)
  })

  it('rejects other values', () => {
    for (const value of [
      'Gib',
      'rec123',
      'recUSF6jZiBVoqG01x',
      'fldUSF6jZiBVoqG01',
      'RECUSF6jZiBVoqG01',
      'recUSF6jZiBVoqG0-',
      'recUSF6jZiBVoqG0',
      1,
      null
    ]) {
      expect(isRecordId(value)).toBe(false)
    }
  })
})
