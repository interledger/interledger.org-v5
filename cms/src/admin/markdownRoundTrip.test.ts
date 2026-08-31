// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  healStrandedListItemBreaks,
  prepareHtmlForMarkdown,
  restoreSoftBreaks,
  SOFT_BREAK_PLACEHOLDER
} from './markdownRoundTrip'

const PH = SOFT_BREAK_PLACEHOLDER

describe('prepareHtmlForMarkdown', () => {
  it('replaces a line break in a bare list item, the case that stranded it', () => {
    expect(prepareHtmlForMarkdown('<ol><li>one<br>two</li></ol>')).toBe(
      `<ol><li>one${PH}two</li></ol>`
    )
  })

  it('replaces a line break in a paragraph', () => {
    expect(prepareHtmlForMarkdown('<p>one<br>two</p>')).toBe(
      `<p>one${PH}two</p>`
    )
  })

  it('replaces every line break in one list item', () => {
    expect(prepareHtmlForMarkdown('<ul><li>a<br>b<br>c</li></ul>')).toBe(
      `<ul><li>a${PH}b${PH}c</li></ul>`
    )
  })

  it('replaces a line break nested in inline formatting', () => {
    expect(
      prepareHtmlForMarkdown('<ul><li><strong>a<br>b</strong></li></ul>')
    ).toBe(`<ul><li><strong>a${PH}b</strong></li></ul>`)
  })

  it('leaves a line break inside a code block alone', () => {
    const code = '<pre><code>line1<br>line2</code></pre>'
    expect(prepareHtmlForMarkdown(code)).toBe(code)
  })

  it('leaves a line break inside inline code alone', () => {
    const code = '<p><code>a<br>b</code></p>'
    expect(prepareHtmlForMarkdown(code)).toBe(code)
  })

  it('leaves content with no line break untouched', () => {
    const html = '<ul><li>alpha</li><li>beta</li></ul>'
    expect(prepareHtmlForMarkdown(html)).toBe(html)
  })

  it('merges a multi-paragraph table cell into one, two breaks per boundary', () => {
    expect(
      prepareHtmlForMarkdown(
        '<table><tr><td><p>a</p><p>b</p></td></tr></table>'
      )
    ).toContain(`<td><p>a${PH}${PH}b</p></td>`)
  })

  it('replaces a line break already inside a table cell', () => {
    expect(
      prepareHtmlForMarkdown('<table><tr><td>a<br>b</td></tr></table>')
    ).toContain(`<td>a${PH}b</td>`)
  })
})

describe('restoreSoftBreaks', () => {
  it('writes each placeholder back as a line break', () => {
    expect(restoreSoftBreaks(`1. one${PH}two`)).toBe('1. one<br />two')
  })

  it('leaves markdown with no placeholder untouched', () => {
    expect(restoreSoftBreaks('1. one\n2. two')).toBe('1. one\n2. two')
  })
})

describe('healStrandedListItemBreaks', () => {
  it('rejoins a break stranded by the editor', () => {
    expect(healStrandedListItemBreaks('1. one\n   <br />\n\n   two')).toBe(
      '1. one<br />two'
    )
  })

  it('rejoins a break stranded by prettier, which adds the second blank line', () => {
    expect(healStrandedListItemBreaks('1. one\n\n   <br />\n\n   two')).toBe(
      '1. one<br />two'
    )
  })

  it('rejoins every stranded break in a list', () => {
    expect(
      healStrandedListItemBreaks(
        '1. one\n   <br />\n\n   first\n2. two\n   <br />\n\n   second'
      )
    ).toBe('1. one<br />first\n2. two<br />second')
  })

  it('rejoins a break stranded in a nested list item', () => {
    expect(
      healStrandedListItemBreaks('* alpha\n  * one\n    <br />\n\n    two')
    ).toBe('* alpha\n  * one<br />two')
  })

  it('accepts the unclosed spelling the editor writes', () => {
    expect(healStrandedListItemBreaks('1. one\n   <br>\n\n   two')).toBe(
      '1. one<br />two'
    )
  })

  it('leaves a trailing break alone: there is no paragraph to rejoin it to', () => {
    const markdown = '1. one\n\n   body text.\n\n   <br />\n'
    expect(healStrandedListItemBreaks(markdown)).toBe(markdown)
  })

  it('leaves a break used as spacing between top-level paragraphs alone', () => {
    const markdown = 'Some text.\n\n<br />\n\nMore text.'
    expect(healStrandedListItemBreaks(markdown)).toBe(markdown)
  })

  it('leaves an already inline break alone', () => {
    const markdown = '1. one<br />two\n2. three'
    expect(healStrandedListItemBreaks(markdown)).toBe(markdown)
  })
})
