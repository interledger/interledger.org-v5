import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/report-section.serializer'

// Side-effect import: registers ReportSection handler
import './reportSectionHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('ReportSection round-trip (serialize → parse)', () => {
  it('round-trips a block with a heading and one Paragraph block (en)', async () => {
    const original = {
      heading: 'Introduction',
      reportText: [
        { textType: 'Paragraph', textContent: 'The full report body.' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })

  it('round-trips a block with a heading and one Paragraph block (es)', async () => {
    const original = {
      heading: 'Introducción',
      reportText: [
        {
          textType: 'Paragraph',
          textContent: 'El cuerpo completo del informe.'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })

  it('round-trips a block mixing Paragraph and Disclaimer content, preserving order', async () => {
    const original = {
      heading: 'Overview',
      reportText: [
        { textType: 'Paragraph', textContent: 'The full report body.' },
        {
          textType: 'Disclaimer',
          textDisclaimer: 'For informational purposes only.'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })

  it('preserves brace-escaped content through a round-trip', async () => {
    const original = {
      heading: 'Overview',
      reportText: [
        { textType: 'Paragraph', textContent: 'Use {tokens} wisely.' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)
    if (!Array.isArray(blocks)) throw blocks

    const [first] = (
      blocks[0] as { reportText: Array<{ textContent: string }> }
    ).reportText

    expect(first.textContent).toContain('{tokens}')
  })

  // mdxTransformer.ts always passes sourceText, which the case above
  // doesn't — so it misses the raw-slicing path that actually ships.
  it('preserves brace-escaped content through a round-trip in production context (sourceText provided)', async () => {
    const original = {
      heading: 'Overview',
      reportText: [
        { textType: 'Paragraph', textContent: 'Use {tokens} wisely.' }
      ]
    }
    const mdx = serialize(original)

    const blocks = await parseMdxToBlocks(mdx, { ...enCtx, sourceText: mdx })
    if (!Array.isArray(blocks)) throw blocks

    const [first] = (
      blocks[0] as { reportText: Array<{ textContent: string }> }
    ).reportText

    expect(first.textContent).toBe('Use {tokens} wisely.')
  })

  // Without unescaping, each cycle adds another backslash until the MDX
  // becomes unparseable.
  it('keeps brace-escaped content stable across repeated export/import cycles', async () => {
    let current: { textType: 'Paragraph'; textContent: string } = {
      textType: 'Paragraph',
      textContent: 'Use {tokens} wisely.'
    }

    for (let cycle = 0; cycle < 3; cycle++) {
      const mdx = serialize({ heading: 'Overview', reportText: [current] })
      const blocks = await parseMdxToBlocks(mdx, { ...enCtx, sourceText: mdx })
      if (!Array.isArray(blocks)) throw blocks

      const [first] = (
        blocks[0] as { reportText: Array<{ textContent: string }> }
      ).reportText
      current = { textType: 'Paragraph', textContent: first.textContent }
    }

    expect(current.textContent).toBe('Use {tokens} wisely.')
  })

  it('round-trips a heading with quotes, ampersands and angle brackets', async () => {
    const original = {
      heading: 'Q&A "Overview" <2026>',
      reportText: [{ textType: 'Paragraph', textContent: 'Body text.' }]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })

  it('round-trips a markdown link in the content', async () => {
    const original = {
      heading: 'Overview',
      reportText: [
        {
          textType: 'Paragraph',
          textContent: 'See the [grant overview](/grant).'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })

  // Content ending in a list is the case that broke Faq's build: MDX reads an
  // indented line after a list item as a continuation of that item, so an
  // indented closing tag gets swallowed. parseMdxToBlocks uses the same
  // remark-mdx machinery as the build, so it catches it here too.
  it('round-trips content ending in a list', async () => {
    const original = {
      heading: 'Overview',
      reportText: [
        {
          textType: 'Paragraph',
          textContent:
            'We are not a financial institution.\n\n- bullet one\n- bullet two'
        },
        { textType: 'Disclaimer', textDisclaimer: 'For general guidance.' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.report-section', ...original }
    ])
  })
})
