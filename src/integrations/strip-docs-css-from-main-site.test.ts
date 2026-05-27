import { describe, expect, it } from 'vitest'
import {
  inlineBlockingStylesheetLinks,
  optimizeMainSiteCss,
  removeDocsStylesheetLinks
} from './strip-docs-css-from-main-site'

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
})

describe('inlineBlockingStylesheetLinks', () => {
  it('inlines project CSS but keeps print stylesheets external', () => {
    const html =
      '<link rel="stylesheet" href="/_astro/HomePage.DuDcdyrR.css">' +
      '<link rel="stylesheet" href="/_astro/print.DNXP8c50.css" media="print">'

    const next = inlineBlockingStylesheetLinks(html, (name) =>
      name === 'HomePage.DuDcdyrR.css' ? '.hero{color:red}' : undefined
    )

    expect(next).toBe(
      '<style>.hero{color:red}</style>' +
        '<link rel="stylesheet" href="/_astro/print.DNXP8c50.css" media="print">'
    )
  })
})

describe('optimizeMainSiteCss', () => {
  it('strips docs CSS then inlines remaining blocking links', () => {
    const docs = new Set(['index@_@astro.D3DUHRfX.css'])
    const html =
      '<link rel="stylesheet" href="/_astro/index@_@astro.D3DUHRfX.css">' +
      '<link rel="stylesheet" href="/_astro/LinkButton.BbH19bkP.css">'

    const next = optimizeMainSiteCss(html, docs, (name) =>
      name === 'LinkButton.BbH19bkP.css' ? '.btn{padding:0}' : undefined
    )

    expect(next).toBe('<style>.btn{padding:0}</style>')
  })
})
