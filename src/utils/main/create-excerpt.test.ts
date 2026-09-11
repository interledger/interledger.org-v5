import { describe, expect, it } from 'vitest'
import {
  createDisplayPlainText,
  createExcerpt,
  createSearchPlainText
} from './create-excerpt'

describe('createExcerpt', () => {
  it('strips inline markdown down to plain text', () => {
    expect(createExcerpt('A **bold** and _italic_ line.')).toBe(
      'A bold and italic line.'
    )
  })

  it('drops link hrefs but keeps the link text', () => {
    expect(createExcerpt('See [the docs](https://example.com/docs).')).toBe(
      'See the docs.'
    )
  })

  it('skips images and figures entirely', () => {
    expect(createExcerpt('Before ![alt text](/img/x.png) after.')).toBe(
      'Before after.'
    )
  })

  // html-to-text renders headings uppercase and the second convert() pass
  // collapses the blank line. Blog excerpts have always looked like this.
  it('strips heading markers, upper-casing the heading text', () => {
    expect(createExcerpt('## Heading\n\nBody text.')).toBe('HEADING Body text.')
  })

  it('returns an empty string for non-string input', () => {
    expect(createExcerpt(undefined)).toBe('')
    expect(createExcerpt(null)).toBe('')
    expect(createExcerpt(42)).toBe('')
  })
})

describe('createDisplayPlainText', () => {
  it('keeps heading case and drops the ATX marker', () => {
    expect(createDisplayPlainText('# Open payments')).toBe('Open payments')
  })

  it('drops setext underlines and blockquote carets', () => {
    expect(
      createDisplayPlainText('Open payments\n=============\n\n> wallets first')
    ).toBe('Open payments wallets first')
  })
})

describe('createSearchPlainText', () => {
  it('keeps ATX heading markers so they stay queryable', () => {
    expect(createSearchPlainText('## Heading\n\nBody text.')).toContain(
      '## Heading'
    )
  })

  it('keeps setext heading underlines', () => {
    expect(createSearchPlainText('Heading\n===\n\nBody.')).toContain('===')
  })

  it('keeps blockquote markers', () => {
    expect(createSearchPlainText('> Quoted line')).toContain('> Quoted line')
  })

  it('still strips inline markdown like createExcerpt does', () => {
    expect(createSearchPlainText('A **bold** word.')).toBe('A bold word.')
  })

  it('returns an empty string for non-string input', () => {
    expect(createSearchPlainText(undefined)).toBe('')
  })
})
