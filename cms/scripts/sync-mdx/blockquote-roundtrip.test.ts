import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/blockquote.serializer'

// Side-effect import: registers Blockquote handler
import './blockquoteHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('Blockquote round-trip (serialize → parse)', () => {
  it('round-trip with source (en)', async () => {
    const original = {
      quote: 'The Internet is for everyone.',
      source: 'Vint Cerf'
    }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.blockquote',
      source: 'Vint Cerf'
    })
    // formatBlockquote wraps in curly quotes, so use toContain
    expect((blocks[0] as { quote: string }).quote).toContain(
      'Internet is for everyone'
    )
  })

  it('round-trip with source (es)', async () => {
    const original = {
      quote: 'La Internet es para todos.',
      source: 'Vint Cerf'
    }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, esCtx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.blockquote',
      source: 'Vint Cerf'
    })
    expect((blocks[0] as { quote: string }).quote).toContain(
      'La Internet es para todos'
    )
  })

  it('round-trip without source', async () => {
    const original = { quote: 'A simple thought.' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.blockquote' })
    expect(blocks[0]).not.toHaveProperty('source')
    expect((blocks[0] as { quote: string }).quote).toContain('simple thought')
  })

  it('round-trip preserves brace-escaped content', async () => {
    const original = { quote: 'Use {templates} wisely.' }
    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, enCtx)

    expect(blocks).toHaveLength(1)
    expect((blocks[0] as { quote: string }).quote).toContain('templates')
  })
})
