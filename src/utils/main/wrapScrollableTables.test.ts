import { describe, expect, it } from 'vitest'
import {
  TABLE_SCROLL_CLASS,
  wrapScrollableTables
} from './wrapScrollableTables'

describe('wrapScrollableTables', () => {
  it('returns html unchanged when there is no table', () => {
    const html = '<p>Hello</p>'
    expect(wrapScrollableTables(html, 'Scrollable table')).toBe(html)
  })

  it('wraps a table in a focusable scroll region', () => {
    const html = '<table><tr><td>Cell</td></tr></table>'
    const out = wrapScrollableTables(html, 'Scrollable table')

    expect(out).toContain(`class="${TABLE_SCROLL_CLASS}"`)
    expect(out).toContain('role="region"')
    expect(out).toContain('aria-label="Scrollable table"')
    expect(out).toContain('tabindex="0"')
    expect(out).toContain('data-lenis-prevent')
    expect(out).toContain('<table>')
  })

  it('escapes quotes in aria-label', () => {
    const out = wrapScrollableTables(
      '<table></table>',
      'Table "wide" version'
    )
    expect(out).toContain('aria-label="Table &quot;wide&quot; version"')
  })

  it('wraps multiple tables independently', () => {
    const html = '<table id="a"></table><p>x</p><table id="b"></table>'
    const out = wrapScrollableTables(html, 'Scrollable table')
    expect(out.match(/class="table-scroll"/g)?.length).toBe(2)
  })
})
