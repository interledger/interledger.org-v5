import { describe, expect, it } from 'vitest'
import { buildMonths, buildQuarterHeaders } from './grid'

describe('buildMonths', () => {
  it('emits one entry per month, inclusive of both ends', () => {
    const months = buildMonths(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 2, 15))
    )
    expect(months.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('crosses the year boundary', () => {
    const months = buildMonths(
      new Date(Date.UTC(2026, 10, 1)),
      new Date(Date.UTC(2027, 1, 1))
    )
    expect(months).toHaveLength(4)
    expect(months[3]).toMatchObject({ year: 2027, month: 1 })
  })

  it('flags quarter starts and assigns 1-based columns (label = col 1)', () => {
    const months = buildMonths(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 3, 1))
    )
    expect(months[0]).toMatchObject({ month: 0, isQuarterStart: true, col: 2 })
    expect(months[3]).toMatchObject({ month: 3, isQuarterStart: true, col: 5 })
  })
})

describe('buildQuarterHeaders', () => {
  it('groups months into quarter spans labelled by quarter and year', () => {
    const months = buildMonths(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 4, 1))
    )
    const headers = buildQuarterHeaders(months)
    expect(headers).toEqual([
      { label: 'Q1 2026', q: 1, year: 2026, colStart: 2, span: 3 },
      { label: 'Q2 2026', q: 2, year: 2026, colStart: 5, span: 2 }
    ])
  })

  it('does not merge the same quarter number across different years', () => {
    const months = buildMonths(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2027, 0, 1))
    )
    const headers = buildQuarterHeaders(months)
    const q1s = headers.filter((h) => h.q === 1)
    expect(q1s.map((h) => h.year)).toEqual([2026, 2027])
  })
})
