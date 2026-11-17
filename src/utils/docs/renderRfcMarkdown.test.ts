import { parse } from 'node-html-parser'
import { describe, expect, it } from 'vitest'
import { renderRfcMarkdown } from './renderRfcMarkdown'

const options = {
  sourceUrl:
    'https://raw.githubusercontent.com/interledger/rfcs/master/0022-hashed-timelock-agreements/0022-hashed-timelock-agreements.md',
  docsBasePath: '/developers'
}

const frontMatter = '---\ntitle: Hashed-Timelock Agreements\n---\n'

describe('renderRfcMarkdown', () => {
  // INTORG-1398: a wide table widened the whole page on mobile.
  it('wraps each table in a focusable scroll region', () => {
    const markdown = `${frontMatter}
| Type | Settlement | Security |
| ---- | ---------- | -------- |
| Simple payment channel | Off-ledger | Medium |
`

    const region = parse(renderRfcMarkdown(markdown, options)).querySelector(
      '.table-scroll'
    )

    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-label')).toBe('Scrollable table')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.querySelector('table th')?.textContent).toBe('Type')
  })

  it('adds no scroll region when the RFC has no table', () => {
    const html = renderRfcMarkdown(`${frontMatter}\nJust prose.\n`, options)

    expect(html).not.toContain('table-scroll')
    expect(html).toContain('<p>Just prose.</p>')
  })

  it('leaves the front matter out of the page', () => {
    const html = renderRfcMarkdown(`${frontMatter}\n## Overview\n`, options)

    expect(html).not.toContain('title:')
    expect(html).toContain('Overview')
  })
})
