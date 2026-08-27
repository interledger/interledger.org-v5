import { describe, expect, it } from 'vitest'
import { panelMaxHeightSteps } from './header-nav'

const state = (overrides: Partial<Parameters<typeof panelMaxHeightSteps>[0]>) =>
  panelMaxHeightSteps({
    isWideNav: false,
    isOpen: false,
    inlineMaxHeight: '',
    contentHeight: 964,
    ...overrides
  })

describe('panelMaxHeightSteps', () => {
  it('caps an open panel at its own content height, not the viewport', () => {
    expect(state({ isOpen: true })).toEqual(['964px'])
  })

  it('caps an open panel taller than any viewport at its full height', () => {
    expect(state({ isOpen: true, contentHeight: 4000 })).toEqual(['4000px'])
  })

  it('collapses a closed panel straight to zero', () => {
    expect(state({})).toEqual(['0px'])
  })

  it('restores a pixel height before collapsing an uncapped panel', () => {
    expect(state({ inlineMaxHeight: 'none' })).toEqual(['964px', '0px'])
  })

  it('clears the inline cap on the desktop breakpoint', () => {
    expect(state({ isWideNav: true, isOpen: true })).toEqual([''])
    expect(state({ isWideNav: true, inlineMaxHeight: 'none' })).toEqual([''])
  })

  it('handles a panel measured at zero height', () => {
    expect(state({ isOpen: true, contentHeight: 0 })).toEqual(['0px'])
  })
})
