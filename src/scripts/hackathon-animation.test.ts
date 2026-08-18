import { describe, expect, it } from 'vitest'
import {
  computeViewProgress,
  getChevronTarget,
  stepSpring
} from './hackathon-animation'

describe('computeViewProgress', () => {
  it('maps sectionTopInViewport from start (0) to end (1)', () => {
    expect(computeViewProgress(900, 900, 450)).toBe(0)
    expect(computeViewProgress(675, 900, 450)).toBeCloseTo(0.5)
    expect(computeViewProgress(450, 900, 450)).toBe(1)
  })

  it('clamps outside the [start, end] range', () => {
    expect(computeViewProgress(1000, 900, 450)).toBe(0)
    expect(computeViewProgress(0, 900, 450)).toBe(1)
  })

  it('steps instead of dividing by ~0 when start and end coincide', () => {
    expect(computeViewProgress(900, 900, 900)).toBe(1)
    expect(computeViewProgress(901, 900, 900)).toBe(0)
    expect(computeViewProgress(899, 900, 900)).toBe(1)
  })

  it('never returns NaN even at the exact collapse point', () => {
    const result = computeViewProgress(900, 900, 900)
    expect(Number.isNaN(result)).toBe(false)
  })
})

describe('getChevronTarget', () => {
  it('travels negative for left, positive for right, scaled by ratio', () => {
    expect(getChevronTarget(1, 'left', 1, 400)).toBe(-400)
    expect(getChevronTarget(1, 'right', 1, 400)).toBe(400)
    expect(getChevronTarget(1, 'left', 0.5, 400)).toBe(-200)
    expect(getChevronTarget(0, 'left', 1, 400)).toBeCloseTo(0)
  })
})

describe('stepSpring', () => {
  it('moves toward the target and never produces NaN for finite inputs', () => {
    const { x, v } = stepSpring(0, 0, 100, 1 / 60)
    expect(Number.isNaN(x)).toBe(false)
    expect(Number.isNaN(v)).toBe(false)
    expect(x).toBeGreaterThan(0)
  })
})
