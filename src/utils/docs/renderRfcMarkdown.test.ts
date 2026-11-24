import { parse } from 'node-html-parser'
import { describe, expect, it } from 'vitest'
import { renderRfcMarkdown } from './renderRfcMarkdown'

const options = {
  sourceUrl:
    'https://raw.githubusercontent.com/interledger/rfcs/master/0022-hashed-timelock-agreements/0022-hashed-timelock-agreements.md',
  docsBasePath: '/developers',
  localImageUrl: (sourcePath: string) =>
    sourcePath === 'shared/graphs/diagram.svg'
      ? '/_astro/diagram.abc123.svg'
      : undefined
}

function render(markdown: string): string {
  const html = renderRfcMarkdown(markdown, options)
  if (html instanceof Error) throw html
  return html
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

    const region = parse(render(markdown)).querySelector('.table-scroll')

    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-label')).toBe('Scrollable table')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.querySelector('table th')?.textContent).toBe('Type')
  })

  it('adds no scroll region when the RFC has no table', () => {
    const html = render(`${frontMatter}\nJust prose.\n`)

    expect(html).not.toContain('table-scroll')
    expect(html).toContain('<p>Just prose.</p>')
  })

  it('leaves the front matter out of the page', () => {
    const html = render(`${frontMatter}\n## Overview\n`)

    expect(html).not.toContain('title:')
    expect(html).toContain('Overview')
  })

  // INTORG-1465: diagrams loaded from raw.githubusercontent.com at view time.
  it('serves interledger/rfcs images from their local copy', () => {
    const html = render(
      `${frontMatter}\n![Diagram](https://raw.githubusercontent.com/interledger/rfcs/master/shared/graphs/diagram.svg)\n`
    )

    expect(parse(html).querySelector('img')?.getAttribute('src')).toBe(
      '/_astro/diagram.abc123.svg'
    )
  })

  it('returns an error naming the image when it has no local copy', () => {
    const result = renderRfcMarkdown(
      `${frontMatter}\n![Missing](../shared/graphs/missing.svg)\n`,
      options
    )

    expect(result).toBeInstanceOf(Error)
    expect(String(result)).toContain('shared/graphs/missing.svg')
    expect(String(result)).toContain('pnpm sync:rfcs')
  })
})
