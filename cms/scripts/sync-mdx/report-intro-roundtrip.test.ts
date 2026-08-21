import { describe, it, expect } from 'vitest'
import { generateReportMdx } from '../../src/utils/reportMdx'
import { extractReportIntro } from './reportIntroHandler'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'

// Side-effect import: registers the ReportSection/ReportText handler.
import './reportSectionHandler'

const ctx = (mdx: string): ParserContext => ({ locale: 'en', sourceText: mdx })

const REPORT_WITH_FOOTNOTE = {
  title: 'Test Report',
  pathSlug: 'test-report',
  section: 'foundation' as const,
  heading: 'Test Report',
  description: 'A test report.',
  introParagraph: 'An intro that cites a source[^1].\n\n[^1]: The source.',
  content: [
    {
      __component: 'blocks.report-section',
      heading: 'A Section',
      reportText: [{ textType: 'Paragraph', textContent: 'Body text.' }]
    }
  ]
}

describe('ReportIntro round-trip (introParagraph footnotes)', () => {
  it('generateReportMdx wraps introParagraph verbatim in a leading <ReportIntro>', () => {
    const mdx = generateReportMdx(REPORT_WITH_FOOTNOTE)

    expect(mdx).not.toContain('introParagraph:')
    expect(mdx).toContain('<ReportIntro>')
    expect(mdx).toContain('[^1]')
    expect(mdx).toContain('[^1]: The source.')
    expect(mdx.indexOf('<ReportIntro>')).toBeLessThan(
      mdx.indexOf('<ReportSection>')
    )
  })

  it('extractReportIntro pulls the intro back out, unescaped, ahead of the rest of the body', () => {
    const mdx = generateReportMdx(REPORT_WITH_FOOTNOTE)
    const bodyMatch = mdx.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    const body = bodyMatch?.[1] ?? ''

    const result = extractReportIntro(body)
    if (result instanceof Error) throw result

    expect(result.introParagraph).toContain('[^1]')
    expect(result.introParagraph).toContain('[^1]: The source.')
    expect(result.introParagraph).not.toContain('\\[^')
    expect(result.remainingContent).not.toContain('ReportIntro')
    expect(result.remainingContent).toContain('<ReportSection>')
  })

  it('the remaining content still parses into blocks.report-section only', async () => {
    const mdx = generateReportMdx(REPORT_WITH_FOOTNOTE)
    const bodyMatch = mdx.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    const body = bodyMatch?.[1] ?? ''

    const result = extractReportIntro(body)
    if (result instanceof Error) throw result

    const blocks = await parseMdxToBlocks(
      result.remainingContent,
      ctx(result.remainingContent)
    )
    if (blocks instanceof Error) throw blocks

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.report-section' })
  })

  it('rejects a <ReportIntro> that is not the first element', () => {
    const body =
      '<ReportSection>\n\n## Heading\n\n<ReportText type="Paragraph">\n\nText.\n\n</ReportText>\n\n</ReportSection>\n\n<ReportIntro>\n\nToo late.\n\n</ReportIntro>'

    const result = extractReportIntro(body)
    expect(result).toBeInstanceOf(Error)
  })

  it('rejects more than one <ReportIntro>', () => {
    const body =
      '<ReportIntro>\n\nFirst.\n\n</ReportIntro>\n\n<ReportIntro>\n\nSecond.\n\n</ReportIntro>'

    const result = extractReportIntro(body)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns null introParagraph when no <ReportIntro> is present', () => {
    const body =
      '<ReportSection>\n\n## Heading\n\n<ReportText type="Paragraph">\n\nText.\n\n</ReportText>\n\n</ReportSection>'

    const result = extractReportIntro(body)
    if (result instanceof Error) throw result

    expect(result.introParagraph).toBeNull()
    expect(result.remainingContent).toBe(body)
  })

  it('is idempotent across export → import → export', () => {
    const once = generateReportMdx(REPORT_WITH_FOOTNOTE)
    const bodyMatch = once.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    const body = bodyMatch?.[1] ?? ''

    const extracted = extractReportIntro(body)
    if (extracted instanceof Error) throw extracted

    const twice = generateReportMdx({
      ...REPORT_WITH_FOOTNOTE,
      introParagraph: extracted.introParagraph
    })

    expect(twice).toBe(once)
  })
})
