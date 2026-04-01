import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

// Side-effect import: registers Paragraph handler
import './paragraphHandler'

const ctx: ParserContext = { locale: 'en' }

// ---------------------------------------------------------------------------
// Paragraph handler — core behaviour
// ---------------------------------------------------------------------------

describe('Paragraph handler', () => {
  it('parses <Paragraph> with children', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\nSimple text content.\n</Paragraph>',
      ctx
    )

    expect(blocks).toEqual([
      { __component: 'blocks.paragraph', content: 'Simple text content.' }
    ])
  })

  it('parses <Paragraph content="..."> via prop', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph content="Text from prop." />',
      ctx
    )

    expect(blocks).toEqual([
      { __component: 'blocks.paragraph', content: 'Text from prop.' }
    ])
  })

  it('prefers content prop over children when both present', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph content="From prop">\nFrom children\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toBe('From prop')
  })

  it('applies center alignment', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph alignment="center">Centred text.</Paragraph>',
      ctx
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.paragraph',
      alignment: 'center'
    })
  })

  it('applies right alignment', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph alignment="right">Right-aligned text.</Paragraph>',
      ctx
    )

    expect(blocks[0]).toMatchObject({ alignment: 'right' })
  })

  it('omits alignment when not set', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>No alignment.</Paragraph>',
      ctx
    )

    expect(blocks[0]).not.toHaveProperty('alignment')
  })

  it('throws when children are empty (self-closing)', async () => {
    await expect(parseMdxToBlocks('<Paragraph />', ctx)).rejects.toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })

  it('throws when children are empty (open/close with no content)', async () => {
    await expect(
      parseMdxToBlocks('<Paragraph></Paragraph>', ctx)
    ).rejects.toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('throws when content prop is an empty string', async () => {
    await expect(
      parseMdxToBlocks('<Paragraph content="" />', ctx)
    ).rejects.toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })
})

// ---------------------------------------------------------------------------
// Paragraph handler — rich markdown content
// ---------------------------------------------------------------------------

describe('Paragraph handler — rich markdown content', () => {
  it('preserves bold text', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\n**bold** and regular text.\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toContain('**bold**')
  })

  it('preserves italic text', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\n*italic* text here.\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toContain('*italic*')
  })

  it('preserves inline links', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\nVisit [Interledger](https://interledger.org) for more.\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toContain(
      '[Interledger](https://interledger.org)'
    )
  })

  it('preserves images', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\n![A logo](https://example.com/logo.png)\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toContain(
      '![A logo](https://example.com/logo.png)'
    )
  })

  it('normalizes unordered list bullets to dash regardless of input marker', async () => {
    const mdx = [
      '<Paragraph>',
      '* Item one',
      '* Item two',
      '* Item three',
      '</Paragraph>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const content = (blocks[0] as { content: string }).content

    expect(content).toContain('- Item one')
    expect(content).toContain('- Item two')
    expect(content).not.toMatch(/^\* /m)
  })

  it('preserves ordered list numbers', async () => {
    const mdx = [
      '<Paragraph>',
      '1. First step',
      '2. Second step',
      '3. Third step',
      '</Paragraph>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const content = (blocks[0] as { content: string }).content

    expect(content).toContain('1.')
    expect(content).toContain('2.')
    expect(content).toContain('3.')
  })

  it('preserves strikethrough text', async () => {
    const blocks = await parseMdxToBlocks(
      '<Paragraph>\nThis is ~~struck~~ text.\n</Paragraph>',
      ctx
    )

    expect((blocks[0] as { content: string }).content).toContain('~~struck~~')
  })

  it('handles a mix of formatting types', async () => {
    const mdx = [
      '<Paragraph>',
      'Intro with **bold** and *italic* text.',
      '',
      '- Bullet one',
      '- Bullet two',
      '',
      'End with a [link](https://example.com).',
      '</Paragraph>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const content = (blocks[0] as { content: string }).content

    expect(content).toContain('**bold**')
    expect(content).toContain('*italic*')
    expect(content).toContain('- Bullet one')
    expect(content).toContain('[link](https://example.com)')
  })
})

// ---------------------------------------------------------------------------
// Integration: Paragraph mixed with bare markdown
// ---------------------------------------------------------------------------

describe('mixed content with Paragraph', () => {
  it('produces blocks in document order alongside bare markdown', async () => {
    const mdx = [
      'Bare markdown paragraph.',
      '',
      '<Paragraph>**Rich** content paragraph.</Paragraph>',
      '',
      'Another bare paragraph.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({ __component: 'blocks.paragraph' })
    expect((blocks[1] as { content: string }).content).toContain('**Rich**')
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })

  it('preserves HTML entities and brackets when sourceText is provided', async () => {
    const mdx = [
      '<Paragraph>',
      '',
      'Data &amp; AI; The Green &amp; Blue Economy; Creative Digital Economy',
      '',
      '1. Yurning content into currency \\[submitted by Mieska F. 👏 🙌]',
      '',
      '</Paragraph>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, {
      locale: 'en',
      sourceText: mdx
    })

    expect(blocks).toHaveLength(1)
    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('&amp;')
    expect(content).toContain('\\[submitted')
  })
})
