import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

// Side-effect import: registers CalloutText handler
import './calloutTextHandler'

const ctx: ParserContext = { locale: 'en' }

// ---------------------------------------------------------------------------
// CalloutText handler
// ---------------------------------------------------------------------------

describe('CalloutText handler', () => {
  it('parses <CalloutText> with children', async () => {
    const blocks = await parseMdxToBlocks(
      '<CalloutText>\nImportant information here.\n</CalloutText>',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.callout-text',
        content: 'Important information here.'
      }
    ])
  })

  it('handles markdown-rich content', async () => {
    const mdx = [
      '<CalloutText>',
      'This has **bold** and *italic* text.',
      '</CalloutText>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('**bold**')
    expect(content).toContain('*italic*')
  })

  it('handles multiline content', async () => {
    const mdx = [
      '<CalloutText>',
      'First paragraph.',
      '',
      'Second paragraph.',
      '</CalloutText>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('First paragraph.')
    expect(content).toContain('Second paragraph.')
  })

  it('preserves links in children', async () => {
    const mdx = [
      '<CalloutText>',
      'Learn more at [Interledger](https://interledger.org).',
      '</CalloutText>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('[Interledger](https://interledger.org)')
  })

  it('preserves inline HTML in children', async () => {
    const mdx = [
      '<CalloutText>',
      'This has <em>html emphasis</em> and <strong>strong</strong>.',
      '</CalloutText>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('<em>html emphasis</em>')
    expect(content).toContain('<strong>strong</strong>')
  })

  it('throws when children are empty (self-closing)', async () => {
    await expect(
      parseMdxToBlocks('<CalloutText />', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })

  it('throws when children are empty (open/close with no content)', async () => {
    await expect(
      parseMdxToBlocks('<CalloutText></CalloutText>', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })
})

// ---------------------------------------------------------------------------
// Integration: CalloutText mixed with markdown
// ---------------------------------------------------------------------------

describe('mixed content with CalloutText', () => {
  it('produces blocks in document order', async () => {
    const mdx = [
      'Intro paragraph.',
      '',
      '<CalloutText>Pay attention!</CalloutText>',
      '',
      'Closing paragraph.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.callout-text',
      content: 'Pay attention!'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
