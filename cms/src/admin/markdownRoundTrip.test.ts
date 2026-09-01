// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  collapseSoftWraps,
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

  // The real serializer escapes the placeholder into `&#xE000;` when it
  // follows a bold run that closes on punctuation (`**text:**`), so a plain
  // raw-codepoint match misses it and the <br /> is silently dropped.
  it('writes back a placeholder the serializer escaped after a bold run ending in punctuation', () => {
    expect(restoreSoftBreaks('**text:**&#xE000;other text')).toBe(
      '**text:**<br />other text'
    )
  })

  it('writes back an escaped placeholder case-insensitively', () => {
    expect(restoreSoftBreaks('**text:**&#xe000;other text')).toBe(
      '**text:**<br />other text'
    )
  })

  // Symmetric case: the same escaping rule fires when the placeholder sits
  // immediately before a bold/italic run that opens with punctuation.
  it('writes back a placeholder the serializer escaped before a bold run starting with punctuation', () => {
    expect(restoreSoftBreaks('lead&#xE000;**:bold**')).toBe(
      'lead<br />**:bold**'
    )
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

describe('collapseSoftWraps', () => {
  it('rewrites a wrapped paragraph as one line', () => {
    expect(collapseSoftWraps('Take our course and start\nknowing it.')).toBe(
      'Take our course and start knowing it.'
    )
  })

  it('rewrites a wrapped list item, dropping the continuation indent', () => {
    expect(collapseSoftWraps('1. Create a free account or log\n   in.')).toBe(
      '1. Create a free account or log in.'
    )
  })

  it('drops the blockquote marker on a continuation line', () => {
    expect(collapseSoftWraps('> quoted line\n> continues here')).toBe(
      '> quoted line continues here'
    )
  })

  it('drops both markers inside a nested blockquote', () => {
    expect(collapseSoftWraps('> outer\n> > inner line\n> > continues')).toBe(
      '> outer\n> > inner line continues'
    )
  })

  it('rewrites a wrap that falls inside inline formatting', () => {
    expect(collapseSoftWraps('this is **bold\ntext** here')).toBe(
      'this is **bold text** here'
    )
  })

  it('takes the carriage return with a Windows newline', () => {
    expect(collapseSoftWraps('a line\r\nnext line')).toBe('a line next line')
  })

  it('keeps a hard break written as two trailing spaces', () => {
    const markdown = 'a line  \nnext line'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps a hard break written as a trailing backslash', () => {
    const markdown = 'a line\\\nnext line'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps a literal line break the author typed', () => {
    const markdown = 'a line<br />next line'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps the newlines in a fenced code block', () => {
    const markdown = '```js\nconst a = 1\nconst b = 2\n```'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps the newlines in an indented code block', () => {
    const markdown = 'text\n\n    const a = 1\n    const b = 2\n'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps a table intact', () => {
    const markdown = '| h | j |\n| --- | --- |\n| a | b |'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps separate paragraphs apart', () => {
    const markdown = 'first para\n\nsecond para'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps a heading off the paragraph above it', () => {
    const markdown = 'Some text\n\n## Heading\n\nmore'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps list items apart', () => {
    const markdown = '- alpha\n  - beta\n- gamma'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('keeps a setext heading intact', () => {
    const markdown = 'Title\n=====\n\nbody'
    expect(collapseSoftWraps(markdown)).toBe(markdown)
  })

  it('returns single-line markdown untouched', () => {
    expect(collapseSoftWraps('single line')).toBe('single line')
  })
})
