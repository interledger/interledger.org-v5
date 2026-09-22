import { describe, it, expect } from 'vitest'
import {
  FILTER_DROPDOWN_CHECK_CLASS,
  FILTER_DROPDOWN_OPTION_CLASS,
  FILTER_DROPDOWN_PANEL_CLASS,
  FILTER_DROPDOWN_SUMMARY_CLASS
} from './filterDropdown'

describe('filterDropdown classes', () => {
  // A right-anchored panel flips alignment as the selected value changes the
  // trigger width — that inconsistency is what left-0 pins down.
  it('anchors the panel to the trigger left edge', () => {
    expect(FILTER_DROPDOWN_PANEL_CLASS).toContain('left-0')
    expect(FILTER_DROPDOWN_PANEL_CLASS).not.toContain('right-0')
  })

  it('does not fill the selected option — the check mark is the selected state', () => {
    expect(FILTER_DROPDOWN_OPTION_CLASS).not.toContain('aria-selected:bg-')
    expect(FILTER_DROPDOWN_CHECK_CLASS).toContain('group-aria-selected:block')
    expect(FILTER_DROPDOWN_CHECK_CLASS).toContain(
      'group-aria-[current=page]:block'
    )
  })

  it('keeps the trigger caret rotation on the summary', () => {
    expect(FILTER_DROPDOWN_SUMMARY_CLASS).toContain(
      'group-open:[&_svg]:-rotate-90'
    )
  })
})
