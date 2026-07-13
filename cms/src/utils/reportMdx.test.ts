import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { generateReportMdx, type ReportMdxInput } from './reportMdx'

function makeReport(overrides: Partial<ReportMdxInput> = {}): ReportMdxInput {
  return {
    title: 'The Role of Stablecoins',
    pathSlug: 'policy-and-advocacy/role-stablecoins',
    section: 'foundation',
    heading: 'The Role of Stablecoins',
    description: 'A short description of the report, 120 to 160 characters.',
    locale: 'en',
    ...overrides
  }
}

describe('generateReportMdx', () => {
  it('writes core frontmatter fields and the body', () => {
    const mdx = generateReportMdx(
      makeReport({
        content: [
          { __component: 'blocks.paragraph', content: 'The full report body.' }
        ]
      })
    )
    const { data, content } = matter(mdx)

    expect(data.title).toBe('The Role of Stablecoins')
    expect(data.pathSlug).toBe('policy-and-advocacy/role-stablecoins')
    expect(data.section).toBe('foundation')
    expect(data.heading).toBe('The Role of Stablecoins')
    expect(data.description).toBe(
      'A short description of the report, 120 to 160 characters.'
    )
    expect(data.locale).toBe('en')
    expect(content.trim()).toContain('The full report body.')
  })

  it('writes introParagraph to frontmatter when provided', () => {
    const { data } = matter(
      generateReportMdx(makeReport({ introParagraph: 'A short intro.' }))
    )
    expect(data.introParagraph).toBe('A short intro.')
  })

  it('omits introParagraph when not provided', () => {
    const { data } = matter(generateReportMdx(makeReport()))
    expect(data.introParagraph).toBeUndefined()
  })

  it('serializes paragraph blocks from the content dynamic zone', () => {
    const { content } = matter(
      generateReportMdx(
        makeReport({
          content: [
            { __component: 'blocks.paragraph', content: 'The full report body.' }
          ]
        })
      )
    )
    expect(content).toContain('<Paragraph>')
    expect(content).toContain('The full report body.')
  })

  it('writes the date component when publishDate is present', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({ date: { publishDate: '2026-06-15' } })
      )
    )
    expect(data.date).toEqual({ publishDate: '2026-06-15' })
  })

  it('includes lastUpdated within the date component when present', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          date: { publishDate: '2026-06-15', lastUpdated: '2026-07-01' }
        })
      )
    )
    expect(data.date).toEqual({
      publishDate: '2026-06-15',
      lastUpdated: '2026-07-01'
    })
  })

  it('omits the date component entirely when publishDate is absent', () => {
    const { data } = matter(generateReportMdx(makeReport({ date: null })))
    expect(data.date).toBeUndefined()
  })

  it('adds localizes for a non-default locale, using the English slug', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          locale: 'es',
          pathSlug: 'politica-y-defensa/rol-de-las-monedas-estables'
        }),
        'policy-and-advocacy/role-stablecoins'
      )
    )
    expect(data.locale).toBe('es')
    expect(data.localizes).toBe('policy-and-advocacy/role-stablecoins')
  })

  it('does not add localizes for the default locale', () => {
    const { data } = matter(generateReportMdx(makeReport()))
    expect(data.localizes).toBeUndefined()
  })
})
