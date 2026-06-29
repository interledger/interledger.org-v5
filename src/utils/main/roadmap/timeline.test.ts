import { describe, expect, it } from 'vitest'
import { createPositioner } from './timeline'

const START = Date.UTC(2026, 0, 1)
const END = Date.UTC(2027, 0, 1)

describe('createPositioner', () => {
  const pos = createPositioner(START, END)

  it('returns 0% at the timeline start and 100% at the end', () => {
    expect(pos.pctLeft(new Date(START))).toBe(0)
    expect(pos.pctLeft(new Date(END))).toBe(100)
  })

  it('clamps dates outside the range to 0–100', () => {
    expect(pos.pctLeft(new Date(Date.UTC(2020, 0, 1)))).toBe(0)
    expect(pos.pctLeft(new Date(Date.UTC(2030, 0, 1)))).toBe(100)
  })

  it('positions a mid-range date proportionally', () => {
    const mid = createPositioner(0, 100).pctLeft(new Date(50))
    expect(mid).toBeCloseTo(50)
  })

  it('enforces a minimum visible width of 0.5%', () => {
    const d = new Date(START)
    expect(pos.pctWidth(d, d)).toBe(0.5)
  })

  it('computes width proportional to the span', () => {
    const p = createPositioner(0, 100)
    expect(p.pctWidth(new Date(10), new Date(40))).toBeCloseTo(30)
  })
})
