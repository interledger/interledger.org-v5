import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers ReportSection handler
import './reportSectionHandler'

const ctx: ParserContext = { locale: 'en' }

const textItem = (type: string, content = 'Some content.') =>
  [`<ReportText type="${type}">`, content, '</ReportText>'].join('\n')

const reportSection = (items: string[], attrs = ' heading="Introduction"') =>
  [`<ReportSection${attrs}>`, ...items, '</ReportSection>'].join('\n')

describe('ReportSection handler', () => {
  it('parses a block with a heading and a single Paragraph content block', async () => {
    const blocks = await parseMdxToBlocks(
      reportSection([textItem('Paragraph', 'The full report body.')]),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.report-section',
        heading: 'Introduction',
        reportText: [
          { textType: 'Paragraph', textContent: 'The full report body.' }
        ]
      }
    ])
  })

  it('parses a Disclaimer content block', async () => {
    const blocks = await parseMdxToBlocks(
      reportSection([textItem('Disclaimer', 'For informational use only.')]),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.report-section',
        heading: 'Introduction',
        reportText: [
          {
            textType: 'Disclaimer',
            textDisclaimer: 'For informational use only.'
          }
        ]
      }
    ])
  })

  it('parses multiple content blocks, preserving order', async () => {
    const blocks = await parseMdxToBlocks(
      reportSection([
        textItem('Paragraph', 'First'),
        textItem('Disclaimer', 'Second'),
        textItem('Paragraph', 'Third')
      ]),
      ctx
    )
    if (!Array.isArray(blocks)) throw blocks

    expect(
      (
        blocks[0] as {
          reportText: Array<{ textContent?: string; textDisclaimer?: string }>
        }
      ).reportText.map((item) => item.textContent ?? item.textDisclaimer)
    ).toEqual(['First', 'Second', 'Third'])
  })

  it('keeps a multi-paragraph content block as markdown', async () => {
    const mdx = reportSection([
      [
        '<ReportText type="Paragraph">',
        'First paragraph.',
        '',
        'Second paragraph.',
        '</ReportText>'
      ].join('\n')
    ])

    const blocks = await parseMdxToBlocks(mdx, ctx)
    if (!Array.isArray(blocks)) throw blocks

    const [first] = (
      blocks[0] as { reportText: Array<{ textContent: string }> }
    ).reportText

    expect(first.textContent).toContain('First paragraph.')
    expect(first.textContent).toContain('Second paragraph.')
  })

  it('keeps markdown links in the content', async () => {
    const blocks = await parseMdxToBlocks(
      reportSection([
        textItem('Paragraph', 'See the [grant overview](/grant).')
      ]),
      ctx
    )
    if (!Array.isArray(blocks)) throw blocks

    const [first] = (
      blocks[0] as { reportText: Array<{ textContent: string }> }
    ).reportText

    expect(first.textContent).toContain('[grant overview](/grant)')
  })

  it('errors when the block has no heading', async () => {
    const mdx = reportSection([textItem('Paragraph')], '')
    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when the block has no ReportText children', async () => {
    const result = await parseMdxToBlocks(
      '<ReportSection heading="Introduction" />',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when a ReportText is missing its type attribute', async () => {
    const mdx = reportSection(['<ReportText>\nSome content.\n</ReportText>'])

    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when a ReportText has an invalid type value', async () => {
    const mdx = reportSection([textItem('Quote')])

    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.INVALID_PROP_VALUE
    )
  })

  it('errors when a ReportText has no content', async () => {
    const mdx = reportSection(['<ReportText type="Paragraph"></ReportText>'])

    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.INVALID_PROP_VALUE
    )
  })
})
