import { describe, expect, it } from 'vitest'
import {
  isClippedLink,
  shouldHideReadMoreToggle,
  umamiLabelForReadMoreClick
} from './grantee-description'

describe('umamiLabelForReadMoreClick', () => {
  it('logs "read more" when the click expands the description', () => {
    expect(umamiLabelForReadMoreClick(true, 'read more', 'read less')).toBe(
      'read more'
    )
  })

  it('logs "read less" when the click collapses the description', () => {
    expect(umamiLabelForReadMoreClick(false, 'read more', 'read less')).toBe(
      'read less'
    )
  })
})

describe('shouldHideReadMoreToggle', () => {
  it('keeps the toggle while the description is expanded', () => {
    expect(shouldHideReadMoreToggle(true, false)).toBe(false)
    expect(shouldHideReadMoreToggle(true, true)).toBe(false)
  })

  it('hides the toggle when collapsed text no longer overflows', () => {
    expect(shouldHideReadMoreToggle(false, false)).toBe(true)
  })

  it('keeps the toggle when collapsed text still overflows', () => {
    expect(shouldHideReadMoreToggle(false, true)).toBe(false)
  })
})

describe('isClippedLink', () => {
  const TEXT_BOTTOM = 100

  it('clips a collapsed link that starts below the visible lines', () => {
    expect(isClippedLink(false, 120, TEXT_BOTTOM)).toBe(true)
  })

  it('clips a collapsed link that starts exactly at the clamp edge', () => {
    expect(isClippedLink(false, TEXT_BOTTOM, TEXT_BOTTOM)).toBe(true)
  })

  it('keeps a collapsed link that starts on a visible line', () => {
    expect(isClippedLink(false, 80, TEXT_BOTTOM)).toBe(false)
  })

  it('never clips while the description is expanded', () => {
    expect(isClippedLink(true, 120, TEXT_BOTTOM)).toBe(false)
  })
})
