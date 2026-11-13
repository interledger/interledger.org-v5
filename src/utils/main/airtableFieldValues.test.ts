import { describe, expect, it } from 'vitest'
import {
  formatProblems,
  isIsoDate,
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

describe('isIsoDate', () => {
  it('accepts a date-only value as Airtable writes it', () => {
    expect(isIsoDate('2026-11-20')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })

  it('rejects a day that does not exist', () => {
    for (const value of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10'
    ]) {
      expect(isIsoDate(value)).toBe(false)
    }
  })

  it('rejects any other format', () => {
    for (const value of [
      '20/11/2026',
      '2026-11-20T00:00:00Z',
      '2026-1-2',
      ''
    ]) {
      expect(isIsoDate(value)).toBe(false)
    }
  })
})
