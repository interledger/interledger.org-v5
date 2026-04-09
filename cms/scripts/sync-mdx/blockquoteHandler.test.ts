import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

// Side-effect import: registers Blockquote handler
import './blockquoteHandler'

const ctx: ParserContext = { locale: 'en' }

// ---------------------------------------------------------------------------
// Blockquote handler
// ---------------------------------------------------------------------------

describe('Blockquote handler', () => {
  it('parses <Blockquote> with source and children', async () => {
    const blocks = await parseMdxToBlocks(
      '<Blockquote source="Albert Einstein">\nImagination is more important than knowledge.\n</Blockquote>',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.blockquote',
        quote: 'Imagination is more important than knowledge.',
        source: 'Albert Einstein'
      }
    ])
  })

  it('parses <Blockquote> without source', async () => {
    const blocks = await parseMdxToBlocks(
      '<Blockquote>\nA simple quote.\n</Blockquote>',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.blockquote',
        quote: 'A simple quote.'
      }
    ])
  })

  it('omits source when not specified', async () => {
    const blocks = await parseMdxToBlocks(
      '<Blockquote>\nQuote text.\n</Blockquote>',
      ctx
    )

    expect(blocks[0]).not.toHaveProperty('source')
  })

  it('handles multiline markdown-rich children', async () => {
    const mdx = [
      '<Blockquote source="Author">',
      'This is **bold** and *italic*.',
      '',
      'And a second paragraph.',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.blockquote',
      source: 'Author'
    })
    const quote = (blocks[0] as { quote: string }).quote
    expect(quote).toContain('**bold**')
    expect(quote).toContain('*italic*')
    expect(quote).toContain('second paragraph')
  })

  it('preserves markdown in source prop', async () => {
    const blocks = await parseMdxToBlocks(
      '<Blockquote source="Vint Cerf is a _good guy_">\nThe Internet is for everyone.\n</Blockquote>',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      source: 'Vint Cerf is a _good guy_'
    })
  })

  it('preserves links in children', async () => {
    const mdx = [
      '<Blockquote>',
      'Visit [Interledger](https://interledger.org) for more.',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const quote = (blocks[0] as { quote: string }).quote
    expect(quote).toContain('[Interledger](https://interledger.org)')
  })

  it('preserves inline HTML in children', async () => {
    const mdx = [
      '<Blockquote>',
      'This has <em>html emphasis</em> and <strong>strong</strong>.',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const quote = (blocks[0] as { quote: string }).quote
    expect(quote).toContain('<em>html emphasis</em>')
    expect(quote).toContain('<strong>strong</strong>')
  })

  it('throws when children are empty (self-closing)', async () => {
    await expect(
      parseMdxToBlocks('<Blockquote source="Author" />', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })

  it('throws when children are empty (open/close with no content)', async () => {
    await expect(
      parseMdxToBlocks('<Blockquote></Blockquote>', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })
})

// ---------------------------------------------------------------------------
// Locale context
// ---------------------------------------------------------------------------

describe('Blockquote handler (locale context)', () => {
  it('parses Blockquote with locale es and Spanish content', async () => {
    const esCtx: ParserContext = { locale: 'es' }
    const blocks = await parseMdxToBlocks(
      '<Blockquote source="Autor">\nUna cita importante.\n</Blockquote>',
      esCtx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.blockquote',
        quote: 'Una cita importante.',
        source: 'Autor'
      }
    ])
  })

  it('produces identical output for en and es locales', async () => {
    const mdx =
      '<Blockquote source="Einstein">\nImagination is everything.\n</Blockquote>'
    const enBlocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    const esBlocks = await parseMdxToBlocks(mdx, { locale: 'es' })

    expect(esBlocks).toEqual(enBlocks)
  })
})

// ---------------------------------------------------------------------------
// Blockquote handler — lists and images
// ---------------------------------------------------------------------------

describe('Blockquote handler — lists and images', () => {
  it('normalizes unordered list bullets to dash regardless of input marker', async () => {
    const mdx = [
      '<Blockquote>',
      '* First item',
      '* Second item',
      '* Third item',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const quote = (blocks[0] as { quote: string }).quote

    expect(quote).toContain('- First item')
    expect(quote).toContain('- Second item')
    expect(quote).not.toMatch(/^\* /m)
  })

  it('preserves ordered list numbers', async () => {
    const mdx = [
      '<Blockquote>',
      '1. First step',
      '2. Second step',
      '3. Third step',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const quote = (blocks[0] as { quote: string }).quote

    expect(quote).toContain('1.')
    expect(quote).toContain('2.')
    expect(quote).toContain('3.')
  })

  it('preserves images', async () => {
    const mdx = [
      '<Blockquote>',
      '![A photo](https://example.com/photo.jpg)',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const quote = (blocks[0] as { quote: string }).quote

    expect(quote).toContain('![A photo](https://example.com/photo.jpg)')
  })

  it('preserves strikethrough text', async () => {
    const mdx = [
      '<Blockquote>',
      'This is ~~struck~~ text.',
      '</Blockquote>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const quote = (blocks[0] as { quote: string }).quote

    expect(quote).toContain('~~struck~~')
  })
})

// ---------------------------------------------------------------------------
// Integration: Blockquote mixed with markdown
// ---------------------------------------------------------------------------

describe('mixed content with Blockquote', () => {
  it('produces blocks in document order', async () => {
    const mdx = [
      'Some intro text.',
      '',
      '<Blockquote source="Author">A wise quote.</Blockquote>',
      '',
      'Closing paragraph.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.blockquote',
      quote: 'A wise quote.',
      source: 'Author'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
