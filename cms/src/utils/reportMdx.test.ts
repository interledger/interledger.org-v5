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
          {
            __component: 'blocks.report-section',
            heading: 'Introduction',
            reportText: [
              { textType: 'Paragraph', textContent: 'The full report body.' }
            ]
          }
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

  it('serializes report-section blocks from the content dynamic zone', () => {
    const { content } = matter(
      generateReportMdx(
        makeReport({
          content: [
            {
              __component: 'blocks.report-section',
              heading: 'Introduction',
              reportText: [
                {
                  textType: 'Paragraph',
                  textContent: 'The full report body.'
                },
                {
                  textType: 'Disclaimer',
                  textDisclaimer: 'This report is for informational purposes.'
                }
              ]
            }
          ]
        })
      )
    )
    expect(content).toContain('<ReportSection>')
    expect(content).toContain('## Introduction')
    expect(content).toContain('<ReportText type="Paragraph">')
    expect(content).toContain('The full report body.')
    expect(content).toContain('<ReportText type="Disclaimer">')
    expect(content).toContain('This report is for informational purposes.')
  })

  it('writes the date component when publishDate is present', () => {
    const { data } = matter(
      generateReportMdx(makeReport({ date: { publishDate: '2026-06-15' } }))
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

describe('generateReportMdx — author bios', () => {
  it('omits authorBios from frontmatter when author_bio is absent', () => {
    const { data } = matter(generateReportMdx(makeReport()))
    expect(data.authorBios).toBeUndefined()
  })

  it('omits authorBios from frontmatter when author_bio is empty', () => {
    const { data } = matter(generateReportMdx(makeReport({ author_bio: [] })))
    expect(data.authorBios).toBeUndefined()
  })

  it('throws when a bio has a null author', () => {
    expect(() =>
      generateReportMdx(makeReport({ author_bio: [{ author: null }] }))
    ).toThrow('Author Bio: Name is required')
  })

  it('throws when a bio has an empty or whitespace-only author', () => {
    expect(() =>
      generateReportMdx(makeReport({ author_bio: [{ author: '' }] }))
    ).toThrow('Author Bio: Name is required')

    expect(() =>
      generateReportMdx(makeReport({ author_bio: [{ author: '   ' }] }))
    ).toThrow('Author Bio: Name is required')
  })

  it('writes multiple bios with author and link', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          author_bio: [
            { author: 'Jane Doe', link: 'https://example.com/jane' },
            { author: 'John Smith' }
          ]
        })
      )
    )
    expect(data.authorBios).toEqual([
      { author: 'Jane Doe', link: 'https://example.com/jane' },
      { author: 'John Smith' }
    ])
  })

  it('writes text from profileBio via ckeditorFieldToMarkdown', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          author_bio: [{ author: 'Jane Doe', profileBio: 'A short bio.' }]
        })
      )
    )
    expect(data.authorBios[0].text).toBe('A short bio.')
  })

  it('writes image and imageAlt, falling back to author for imageAlt', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          author_bio: [
            {
              author: 'Jane Doe',
              media: { image: { url: '/uploads/jane.jpg', name: 'jane.jpg' } }
            }
          ]
        })
      )
    )
    expect(data.authorBios[0].image).toBe('/uploads/jane.jpg')
    expect(data.authorBios[0].imageAlt).toBe('Jane Doe')
  })

  it('writes explicit media.alternativeText for imageAlt over the author fallback', () => {
    const { data } = matter(
      generateReportMdx(
        makeReport({
          author_bio: [
            {
              author: 'Jane Doe',
              media: {
                image: { url: '/uploads/jane.jpg', name: 'jane.jpg' },
                alternativeText: 'Jane Doe headshot'
              }
            }
          ]
        })
      )
    )
    expect(data.authorBios[0].imageAlt).toBe('Jane Doe headshot')
  })
})
