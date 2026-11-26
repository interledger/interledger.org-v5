import { describe, expect, it } from 'vitest'
import {
  formatAirtableDay,
  lastUpdatedJson,
  parseGranteeDataLastUpdated
} from './granteeDataUpdated'

describe('parseGranteeDataLastUpdated', () => {
  it('returns the date', () => {
    expect(parseGranteeDataLastUpdated({ date: '2026-11-24' })).toBe(
      '2026-11-24'
    )
  })

  it.each([
    ['an impossible day', { date: '2026-02-30' }],
    ['a timestamp', { date: '2026-11-24T07:00:00Z' }],
    ['a missing date', {}],
    ['a number', { date: 20261124 }],
    ['no object', null]
  ])('fails on %s', (_, raw) => {
    expect(parseGranteeDataLastUpdated(raw)).toBeInstanceOf(Error)
  })

  it('names the file and the field in the error', () => {
    const error = parseGranteeDataLastUpdated({ date: 'soon' })
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/last-updated\.json.*date/)
  })
})

describe('formatAirtableDay', () => {
  it('formats a full day in each locale', () => {
    expect(formatAirtableDay('2026-11-24', 'en')).toBe('November 24, 2026')
    expect(formatAirtableDay('2026-11-24', 'es')).toBe(
      '24 de noviembre de 2026'
    )
  })

  it('keeps the day at UTC midnight', () => {
    expect(formatAirtableDay('2026-01-01', 'en')).toBe('January 1, 2026')
  })

  it('returns the input when it is not a date', () => {
    expect(formatAirtableDay('soon', 'en')).toBe('soon')
  })
})

describe('lastUpdatedJson', () => {
  it('writes the UTC day, which the parser reads back', () => {
    const json = lastUpdatedJson(new Date('2026-11-24T23:30:00-05:00'))
    expect(parseGranteeDataLastUpdated(JSON.parse(json))).toBe('2026-11-25')
  })

  it('matches the Prettier format of the committed file', () => {
    expect(lastUpdatedJson(new Date('2026-11-24T07:00:00Z'))).toBe(
      '{ "date": "2026-11-24" }\n'
    )
  })
})
