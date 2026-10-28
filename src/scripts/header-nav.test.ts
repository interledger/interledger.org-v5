import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NAV_BAR_QUERY,
  FOUNDATION_NAV_BAR_QUERY,
  panelMaxHeightSteps,
  panelOverflowShift,
  shouldPinSubmenuOnClick
} from './header-nav'

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

describe('panelOverflowShift', () => {
  const VIEWPORT = 1200
  const GUTTER = 32

  it('leaves a panel that fits inside the gutter', () => {
    expect(panelOverflowShift(400, 900, VIEWPORT)).toBe(0)
  })

  it('leaves a panel touching the gutter exactly', () => {
    expect(panelOverflowShift(GUTTER, VIEWPORT - GUTTER, VIEWPORT)).toBe(0)
  })

  it('moves a panel past the right edge back onto the gutter', () => {
    expect(panelOverflowShift(450, 1350, VIEWPORT)).toBe(-182)
  })

  it('moves a panel past the left edge back onto the gutter', () => {
    expect(panelOverflowShift(-50, 600, VIEWPORT)).toBe(82)
  })

  it('pins the left edge when the panel is wider than the space', () => {
    expect(panelOverflowShift(450, 1800, VIEWPORT)).toBe(GUTTER - 450)
  })
})

describe('shouldPinSubmenuOnClick', () => {
  const activation = (
    overrides: Partial<Parameters<typeof shouldPinSubmenuOnClick>[0]>
  ) =>
    shouldPinSubmenuOnClick({
      isWideNav: true,
      clickDetail: 1,
      pointerType: 'mouse',
      ...overrides
    })

  it('does not pin a mouse click on the desktop bar', () => {
    expect(activation({})).toBe(false)
  })

  it('does not pin an untyped click on the desktop bar', () => {
    expect(activation({ pointerType: null })).toBe(false)
  })

  it('pins a keyboard activation on the desktop bar', () => {
    expect(activation({ clickDetail: 0, pointerType: null })).toBe(true)
  })

  it('pins touch and pen taps on the desktop bar', () => {
    expect(activation({ pointerType: 'touch' })).toBe(true)
    expect(activation({ pointerType: 'pen' })).toBe(true)
  })

  it('pins every drawer click, including a mouse click', () => {
    expect(activation({ isWideNav: false })).toBe(true)
    expect(
      activation({ isWideNav: false, clickDetail: 0, pointerType: null })
    ).toBe(true)
  })
})

describe('nav bar queries', () => {
  const tailwindCss = readFileSync('src/styles/tailwind.css', 'utf8')

  /** The widths a nav variant in tailwind.css compares against, in order. */
  const variantWidths = (name: string, operator: '>=' | '<') => {
    const variant = tailwindCss.match(
      new RegExp(`@custom-variant ${name} \\{[\\s\\S]*?\\n\\}`)
    )?.[0]
    return [
      ...(variant ?? '').matchAll(new RegExp(`width ${operator} (\\d+px)`, 'g'))
    ].map((match) => match[1])
  }

  const queryWidth = (query: string) => query.match(/(\d+px)/)?.[1]
  const expectedWidths = [
    queryWidth(FOUNDATION_NAV_BAR_QUERY),
    queryWidth(DEFAULT_NAV_BAR_QUERY)
  ]

  // The JS drawer state and the CSS layout must flip at the same width, or
  // the bar renders with an inert, offscreen menu (or the reverse).
  it('match the widths in the nav-bar CSS variant', () => {
    expect(variantWidths('nav-bar', '>=')).toEqual(expectedWidths)
  })

  // nav-drawer must end exactly where nav-bar starts. A gap leaves a band
  // with neither layout, and an overlap applies both at once.
  it('match the widths in the nav-drawer CSS variant', () => {
    expect(variantWidths('nav-drawer', '<')).toEqual(expectedWidths)
  })
})
