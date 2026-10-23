import { describe, expect, it } from 'vitest'
import { isCalendarDate } from './calendarDate'

describe('isCalendarDate', () => {
  it('accepts a real YYYY-MM-DD day', () => {
    expect(isCalendarDate('2026-10-16')).toBe(true)
    expect(isCalendarDate('2028-02-29')).toBe(true)
  })

  it('rejects a day that does not exist', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
  })

  it('rejects other shapes and non-strings', () => {
    expect(isCalendarDate('Friday October 16')).toBe(false)
    expect(isCalendarDate('2026-10-16T00:00:00Z')).toBe(false)
    expect(isCalendarDate('2026-1-6')).toBe(false)
    expect(isCalendarDate('')).toBe(false)
    expect(isCalendarDate(null)).toBe(false)
    expect(isCalendarDate(20261016)).toBe(false)
  })
})
