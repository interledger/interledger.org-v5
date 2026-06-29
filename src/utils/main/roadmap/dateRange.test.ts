import { describe, expect, it } from 'vitest'
import {
  computeDateRange,
  monthStart,
  monthEnd,
  roadmapWindow,
  projectOverlapsWindow,
  clampRangeToWindow
} from './dateRange'
import { makeProject } from './test-fixtures'

describe('monthStart / monthEnd', () => {
  it('returns the first instant of the month (UTC)', () => {
    expect(monthStart(2026, 0).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('returns the last instant of the month (UTC)', () => {
    expect(monthEnd(2026, 1).toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })
})

describe('computeDateRange', () => {
  it('falls back to now…now+1yr when there are no projects', () => {
    const { minDate, maxDate } = computeDateRange([])
    expect(maxDate.getUTCFullYear() - minDate.getUTCFullYear()).toBe(1)
  })

  it('spans the earliest and latest project dates', () => {
    const projects = [
      makeProject({ startDate: '2026-03-01', targetDate: '2026-08-01' }),
      makeProject({
        id: 'p2',
        startDate: '2026-01-15',
        targetDate: '2026-05-01'
      })
    ]
    const { minDate, maxDate } = computeDateRange(projects)
    expect(minDate.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(maxDate.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('includes milestone target dates in the range', () => {
    const projects = [
      makeProject({
        startDate: '2026-02-01',
        targetDate: '2026-04-01',
        milestones: [{ id: 'm1', name: 'M1', targetDate: '2026-11-01' }]
      })
    ]
    const { maxDate } = computeDateRange(projects)
    expect(maxDate.toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('ignores null milestone dates', () => {
    const projects = [
      makeProject({
        startDate: '2026-02-01',
        targetDate: '2026-04-01',
        milestones: [{ id: 'm1', name: 'M1', targetDate: null }]
      })
    ]
    const { maxDate } = computeDateRange(projects)
    expect(maxDate.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })
})

describe('roadmapWindow', () => {
  it('spans the current calendar year through the end of the next', () => {
    const { start, end } = roadmapWindow(new Date(Date.UTC(2026, 5, 24)))
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2027-12-31T23:59:59.999Z')
  })

  it('advances with the year (never goes stale)', () => {
    const { start, end } = roadmapWindow(new Date(Date.UTC(2027, 0, 1)))
    expect(start.getUTCFullYear()).toBe(2027)
    expect(end.getUTCFullYear()).toBe(2028)
  })
})

describe('projectOverlapsWindow', () => {
  const start = new Date(Date.UTC(2026, 0, 1))
  const end = new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999))

  it('keeps a project spanning into the window', () => {
    const p = makeProject({ startDate: '2023-01-01', targetDate: '2026-06-01' })
    expect(projectOverlapsWindow(p, start, end)).toBe(true)
  })

  it('drops a project entirely before the window', () => {
    const p = makeProject({ startDate: '2023-01-01', targetDate: '2024-12-31' })
    expect(projectOverlapsWindow(p, start, end)).toBe(false)
  })

  it('drops a project entirely after the window', () => {
    const p = makeProject({ startDate: '2028-01-01', targetDate: '2028-06-01' })
    expect(projectOverlapsWindow(p, start, end)).toBe(false)
  })

  it('keeps an undated project (rendered as a no-bar row)', () => {
    expect(projectOverlapsWindow(makeProject(), start, end)).toBe(true)
  })

  it('keeps a project that only overlaps via a milestone', () => {
    const p = makeProject({
      startDate: '2023-01-01',
      targetDate: '2024-01-01',
      milestones: [{ id: 'm', name: 'late', targetDate: '2026-03-01' }]
    })
    expect(projectOverlapsWindow(p, start, end)).toBe(true)
  })
})

describe('clampRangeToWindow', () => {
  const start = new Date(Date.UTC(2026, 0, 1))
  const end = new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999))

  it('clamps a wider data range to the window bounds', () => {
    const { minDate, maxDate } = clampRangeToWindow(
      new Date('2023-05-01'),
      new Date('2029-01-01'),
      start,
      end
    )
    expect(minDate).toBe(start)
    expect(maxDate).toBe(end)
  })

  it('leaves a narrower data range untouched', () => {
    const dMin = new Date('2026-03-01')
    const dMax = new Date('2026-09-01')
    const { minDate, maxDate } = clampRangeToWindow(dMin, dMax, start, end)
    expect(minDate).toBe(dMin)
    expect(maxDate).toBe(dMax)
  })
})
