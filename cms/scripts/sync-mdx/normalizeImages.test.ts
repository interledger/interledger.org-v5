import { describe, it, expect } from 'vitest'
import { normalizeInlineImages } from './normalizeImages'

describe('normalizeInlineImages', () => {
  it('converts HTML img tag to markdown', () => {
    expect(
      normalizeInlineImages('<img src="/img/test.png" alt="A photo" />')
    ).toBe('![A photo](/img/test.png)')
  })

  it('converts JSX img tag with style prop to markdown, dropping style', () => {
    expect(
      normalizeInlineImages(
        '<img src="/img/test.png" alt="A photo" style={{ width: "50%" }} />'
      )
    ).toBe('![A photo](/img/test.png)')
  })

  it('converts non-self-closing HTML img tag', () => {
    expect(
      normalizeInlineImages('<img src="/img/test.png" alt="A photo">')
    ).toBe('![A photo](/img/test.png)')
  })

  it('uses empty string for missing alt', () => {
    expect(normalizeInlineImages('<img src="/img/test.png" />')).toBe(
      '![](/img/test.png)'
    )
  })

  it('uses empty string for missing src', () => {
    expect(normalizeInlineImages('<img alt="A photo" />')).toBe('![A photo]()')
  })

  it('leaves markdown images unchanged', () => {
    const md = '![MARKDOWN_ALT_SURVIVES](/img/test.png)'
    expect(normalizeInlineImages(md)).toBe(md)
  })

  it('converts multiple img tags in one string', () => {
    const input = [
      '<img src="/a.png" alt="First" />',
      'Some text',
      '<img src="/b.png" alt="Second" />'
    ].join('\n')

    expect(normalizeInlineImages(input)).toBe(
      '![First](/a.png)\nSome text\n![Second](/b.png)'
    )
  })

  it('leaves content with no img tags unchanged', () => {
    const md = '## Heading\n\nJust a paragraph with no images.'
    expect(normalizeInlineImages(md)).toBe(md)
  })

  it('drops extra attributes (className, loading, etc) — markdown has no equivalent', () => {
    expect(
      normalizeInlineImages(
        '<img src="/img/test.png" alt="Caption" className="hero" loading="lazy" />'
      )
    ).toBe('![Caption](/img/test.png)')
  })
})
