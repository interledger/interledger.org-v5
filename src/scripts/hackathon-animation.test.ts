import { describe, expect, it } from 'vitest'
import {
  computeViewProgress,
  getChevronTarget,
  integrateSpring,
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

  it('diverges for a single large step — this is exactly why integrateSpring exists', () => {
    // Regression guard for the failure mode itself: a single 0.1s step
    // (the old per-frame dt cap) with these spring constants blows up
    // instead of converging. If this ever stops failing, MAX_STABLE_SPRING_DT
    // in integrateSpring may no longer need to be as small as it is.
    let x = 0
    let v = 0
    for (let i = 0; i < 10; i++) {
      ;({ x, v } = stepSpring(x, v, 100, 0.1))
    }
    expect(Math.abs(x)).toBeGreaterThan(1_000_000)
  })
})

describe('integrateSpring', () => {
  it('converges for a normal 60fps step', () => {
    const { x } = integrateSpring(0, 0, 100, 1 / 60)
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(100)
  })

  it('stays stable and converges even for a large dt that would diverge as a single stepSpring call', () => {
    // Reproduces the reported bug: a delayed/dropped frame during scroll
    // hands tick() a large dt (up to the 0.1s outer cap). A single
    // stepSpring call at that dt diverges (see the test above); repeated
    // ticks with large dt must still converge toward the target instead of
    // flying off to huge, scroll-independent positions.
    let x = 0
    let v = 0
    for (let i = 0; i < 30; i++) {
      ;({ x, v } = integrateSpring(x, v, 100, 0.1))
    }
    expect(x).toBeCloseTo(100, 0)
    expect(Number.isFinite(x)).toBe(true)
    expect(Number.isFinite(v)).toBe(true)
  })

  it('produces the same end state whether dt arrives as one big tick or many small ones', () => {
    // Splitting into substeps must not change a converging trajectory's
    // destination — only smooths out how it gets there.
    const bigStep = integrateSpring(0, 0, 100, 1)
    let small = { x: 0, v: 0 }
    for (let i = 0; i < 120; i++) {
      small = integrateSpring(small.x, small.v, 100, 1 / 120)
    }
    expect(bigStep.x).toBeCloseTo(small.x, 5)
    expect(bigStep.v).toBeCloseTo(small.v, 5)
  })

  it('returns the input unchanged for zero or negative dt', () => {
    expect(integrateSpring(5, 2, 100, 0)).toEqual({ x: 5, v: 2 })
    expect(integrateSpring(5, 2, 100, -1)).toEqual({ x: 5, v: 2 })
  })
})
