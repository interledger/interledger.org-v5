import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize as serializeParagraph } from '../../src/serializers/blocks/paragraph.serializer'

// Side-effect import: registers the Paragraph handler.
import './paragraphHandler'

// A blog body using GFM footnotes: inline references ([^1]) plus their
// definitions. Astro's GFM renders these as linked, auto-numbered footnotes.
const FOOTNOTE_BODY = `This claim needs a note[^1] and here is another[^2].

[^1]: First footnote definition.
[^2]: Second footnote definition.`

// The real sync always passes sourceText so the parser slices the raw source
// (byte-for-byte) instead of re-serializing the AST, which would escape the
// footnote brackets (\\[^1]). Mirror that here.
const ctx = (mdx: string): ParserContext => ({ locale: 'en', sourceText: mdx })

const contentOf = (block: unknown) => (block as { content: string }).content

describe('Footnote round-trip through the sync pipeline (INTORG-838)', () => {
  it('import preserves footnote refs and definitions verbatim (flat markdown)', async () => {
    const blocks = await parseMdxToBlocks(FOOTNOTE_BODY, ctx(FOOTNOTE_BODY))

    expect(blocks).toHaveLength(1)
    const content = contentOf(blocks[0])
    expect(content).toContain('[^1]')
    expect(content).toContain('[^2]')
    expect(content).toContain('[^1]: First footnote definition.')
    // Must not be escaped or converted to plain links.
    expect(content).not.toContain('\\[^')
    expect(content).not.toContain('user-content-fn')
  })

  it('import preserves footnotes when wrapped in <Paragraph> (the exported form)', async () => {
    const exported = serializeParagraph({ content: FOOTNOTE_BODY })
    const blocks = await parseMdxToBlocks(exported, ctx(exported))

    expect(blocks).toHaveLength(1)
    const content = contentOf(blocks[0])
    expect(content).toContain('[^1]')
    expect(content).toContain('[^1]: First footnote definition.')
    expect(content).not.toContain('\\[^')
  })

  it('export wraps footnote content verbatim in <Paragraph>', () => {
    const mdx = serializeParagraph({ content: FOOTNOTE_BODY })

    expect(mdx).toContain('<Paragraph>')
    expect(mdx).toContain('[^1]')
    expect(mdx).toContain('[^1]: First footnote definition.')
  })

  it('is idempotent across export → import → export', async () => {
    const once = serializeParagraph({ content: FOOTNOTE_BODY })
    const blocks = await parseMdxToBlocks(once, ctx(once))
    const twice = serializeParagraph({ content: contentOf(blocks[0]) })

    expect(twice).toBe(once)
  })
})
