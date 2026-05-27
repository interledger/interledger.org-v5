import { describe, expect, it } from 'vitest'
import { removeDocsStylesheetLinks } from './strip-docs-css-from-main-site'

describe('removeDocsStylesheetLinks', () => {
  it('removes only docs stylesheet links', () => {
    const docs = new Set(['index@_@astro.D3DUHRfX.css'])
    const html =
      '<link rel="stylesheet" href="/_astro/HomePage.DuDcdyrR.css">' +
      '<link rel="stylesheet" href="/_astro/index@_@astro.D3DUHRfX.css">' +
      '<link rel="stylesheet" href="/_astro/LinkButton.BbH19bkP.css">'

    expect(removeDocsStylesheetLinks(html, docs)).toBe(
      '<link rel="stylesheet" href="/_astro/HomePage.DuDcdyrR.css">' +
        '<link rel="stylesheet" href="/_astro/LinkButton.BbH19bkP.css">'
    )
  })

  it('returns html unchanged when set is empty', () => {
    const html =
      '<link rel="stylesheet" href="/_astro/index@_@astro.D3DUHRfX.css">'
    expect(removeDocsStylesheetLinks(html, new Set())).toBe(html)
  })
})
