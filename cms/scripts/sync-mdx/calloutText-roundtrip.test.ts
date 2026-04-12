import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '@/serializers/blocks/callout-text.serializer'

// Side-effect import: registers CalloutText handler
import './calloutTextHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('CalloutText round-trip (serialize → parse)', () => {
  it('round-trip plain text (en)', async () => {
    const original = { content: 'Important information.' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.callout-text',
      content: 'Important information.'
    })
  })

  it('round-trip plain text (es)', async () => {
    const original = { content: 'Informacion importante.' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, esCtx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.callout-text',
      content: 'Informacion importante.'
    })
  })

  it('round-trip with markdown content', async () => {
    const original = { content: '**Bold** and *italic* text.' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('**Bold**')
    expect(content).toContain('*italic*')
  })

  it('round-trip with HTML content', async () => {
    const original = { content: '<p>Hello <strong>world</strong></p>' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    const content = (blocks[0] as { content: string }).content
    // HTML is converted to markdown by the serializer, then parsed back
    expect(content).toContain('world')
  })
})
