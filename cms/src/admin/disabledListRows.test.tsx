import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { markDisabledListRows } from './disabledListRows'

const headers = [{ name: 'source' }, { name: 'enabled' }, { name: 'category' }]

function optedIn(flag: unknown) {
  return { options: { listView: { disabledFlag: flag } } }
}

describe('markDisabledListRows', () => {
  it('leaves content types that did not opt in untouched', () => {
    const args = { displayedHeaders: headers, layout: { options: {} } }
    expect(markDisabledListRows(args)).toEqual(args)
  })

  it.each([undefined, '', 42])(
    'ignores a malformed disabledFlag (%j)',
    (flag) => {
      const result = markDisabledListRows({
        displayedHeaders: headers,
        layout: optedIn(flag)
      })
      expect(result.displayedHeaders).toBe(headers)
    }
  )

  it('leads with a Status column and drops the raw flag column', () => {
    const result = markDisabledListRows({
      displayedHeaders: headers,
      layout: optedIn('enabled')
    })
    expect(result.displayedHeaders.map((header) => header.name)).toEqual([
      'listViewStatus',
      'source',
      'category'
    ])
  })

  it.each([
    [false, 'disabled'],
    [true, 'enabled'],
    // Rows stored before the field existed.
    [null, 'enabled']
  ])('renders enabled: %j as %s', (value, state) => {
    const [status] = markDisabledListRows({
      displayedHeaders: headers,
      layout: optedIn('enabled')
    }).displayedHeaders
    const format = status!.cellFormatter as (
      row: Record<string, unknown>
    ) => ReactElement<{ disabled: boolean }>
    expect(format({ enabled: value }).props.disabled).toBe(state === 'disabled')
  })
})
