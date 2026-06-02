import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  getCircleProgress,
  supportsScrollDrivenAnimations,
  TABLET_MIN_WIDTH_PX
} from './animated-network'

describe('animated-network helpers', () => {
  it('getCircleProgress maps circle growth animation range', () => {
    expect(getCircleProgress(0)).toBe(0)
    expect(getCircleProgress(0.25)).toBe(0)
    expect(getCircleProgress(0.35)).toBe(0)
    expect(getCircleProgress(0.63)).toBeCloseTo(0.5)
    expect(getCircleProgress(0.91)).toBe(1)
    expect(getCircleProgress(1)).toBe(1)
  })

  it('uses the tablet breakpoint token from tailwind config', () => {
    expect(TABLET_MIN_WIDTH_PX).toBe(810)
  })
})

describe('supportsScrollDrivenAnimations', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requires named view-timeline and animation-timeline, not scroll() alone', () => {
    vi.stubGlobal('CSS', {
      supports: (property: string, value: string) => {
        if (property === 'animation-timeline' && value === 'scroll()')
          return true
        if (property === 'animation-timeline' && value === 'view()') return true
        return false
      }
    })
    expect(supportsScrollDrivenAnimations()).toBe(false)
  })

  it('returns true when both named timeline properties are supported', () => {
    vi.stubGlobal('CSS', {
      supports: (property: string, value: string) =>
        (property === 'view-timeline' && value === '--network-track block') ||
        (property === 'animation-timeline' && value === '--network-track')
    })
    expect(supportsScrollDrivenAnimations()).toBe(true)
  })
})
