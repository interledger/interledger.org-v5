import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers FooterNotes handler
import './footerNotesHandler'

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('FooterNotes handler', () => {
  it('parses notes with text, linkText, and linkUrl', async () => {
    const blocks = await parseMdxToBlocks(
      `<FooterNotes notes={[{ text: 'First note.', linkText: 'Source', linkUrl: 'https://example.com' }, { text: 'Second note.', linkText: 'https://gasfeesnow.com', linkUrl: 'https://gasfeesnow.com' }]} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.footer-notes',
        notes: [
          {
            text: 'First note.',
            linkText: 'Source',
            linkUrl: 'https://example.com'
          },
          {
            text: 'Second note.',
            linkText: 'https://gasfeesnow.com',
            linkUrl: 'https://gasfeesnow.com'
          }
        ]
      }
    ])
  })

  it('omits linkText/linkUrl when absent', async () => {
    const blocks = await parseMdxToBlocks(
      `<FooterNotes notes={[{ text: 'A plain citation.' }]} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.footer-notes',
        notes: [{ text: 'A plain citation.' }]
      }
    ])
  })

  it('parses a single note', async () => {
    const blocks = await parseMdxToBlocks(
      `<FooterNotes notes={[{ text: 'Only note.' }]} />`,
      { locale: 'en' }
    )
    if (blocks instanceof MdxParserError) throw blocks
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.footer-notes',
      notes: [{ text: 'Only note.' }]
    })
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('FooterNotes handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when notes is missing', async () => {
    const result = await parseMdxToBlocks('<FooterNotes />', { locale: 'en' })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns DYNAMIC_EXPRESSION when notes is a dynamic expression', async () => {
    const result = await parseMdxToBlocks('<FooterNotes notes={someVar} />', {
      locale: 'en'
    })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns INVALID_PROP_VALUE when notes is not an array', async () => {
    const result = await parseMdxToBlocks(
      `<FooterNotes notes={{ text: 'Only note.' }} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a note entry is missing text', async () => {
    const result = await parseMdxToBlocks(
      `<FooterNotes notes={[{ linkText: 'Source', linkUrl: 'https://example.com' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a note has linkText but no linkUrl', async () => {
    const result = await parseMdxToBlocks(
      `<FooterNotes notes={[{ text: 'Note.', linkText: 'Source' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a note has linkUrl but no linkText', async () => {
    const result = await parseMdxToBlocks(
      `<FooterNotes notes={[{ text: 'Note.', linkUrl: 'https://example.com' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when fewer than 1 note is provided', async () => {
    const result = await parseMdxToBlocks(`<FooterNotes notes={[]} />`, {
      locale: 'en'
    })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <FooterNotes> ordering
// ---------------------------------------------------------------------------

describe('FooterNotes handler — mixed content', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Some intro paragraph.',
      '',
      `<FooterNotes notes={[{ text: 'A note.' }]} />`,
      '',
      'More content after the notes.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    if (blocks instanceof MdxParserError) throw blocks

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toEqual({
      __component: 'blocks.footer-notes',
      notes: [{ text: 'A note.' }]
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
