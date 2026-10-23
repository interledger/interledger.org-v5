import { describe, it, expect } from 'vitest'
import type { MarkdownHeading } from 'astro'
import { getReportNavSections, hasReportIntro } from './reportSections'

const h = (depth: number, slug: string, text = slug): MarkdownHeading => ({
  depth,
  slug,
  text
})

const SECTION_HEADINGS = [h(2, 'first-section'), h(2, 'second-section')]
const SECTIONS_BODY =
  '<ReportSection>\n\n## First section\n\n</ReportSection>\n\n<ReportSection>\n\n## Second section\n\n</ReportSection>'

describe('hasReportIntro', () => {
  it('is true only when the body opens with <ReportIntro>', () => {
    expect(hasReportIntro('\n<ReportIntro>\n\nText\n\n</ReportIntro>')).toBe(
      true
    )
    expect(hasReportIntro(SECTIONS_BODY)).toBe(false)
    expect(hasReportIntro('')).toBe(false)
    expect(hasReportIntro(undefined)).toBe(false)
  })
})

describe('getReportNavSections', () => {
  it('lists every section heading when there is no intro', () => {
    expect(getReportNavSections(SECTIONS_BODY, SECTION_HEADINGS)).toEqual([
      { id: 'first-section', heading: 'first-section' },
      { id: 'second-section', heading: 'second-section' }
    ])
  })

  it('drops the H2s inside the intro', () => {
    const body = `<ReportIntro>\n\n## Key takeaways\n\nText.\n\n## More context\n\n</ReportIntro>\n\n${SECTIONS_BODY}`
    const headings = [
      h(2, 'key-takeaways'),
      h(2, 'more-context'),
      ...SECTION_HEADINGS
    ]

    expect(getReportNavSections(body, headings).map((s) => s.id)).toEqual([
      'first-section',
      'second-section'
    ])
  })

  it('keeps a section whose heading text matches an intro heading', () => {
    const body = `<ReportIntro>\n\n## Summary\n\n</ReportIntro>\n\n<ReportSection>\n\n## Summary\n\n</ReportSection>`
    const headings = [h(2, 'summary'), h(2, 'summary-1')]

    expect(getReportNavSections(body, headings).map((s) => s.id)).toEqual([
      'summary-1'
    ])
  })

  it('counts intro H2s nested in a blockquote or a list, and setext H2s', () => {
    const body = `<ReportIntro>\n\n> ## Quoted\n\n- ## Listed\n\nSetext\n---\n\n</ReportIntro>\n\n${SECTIONS_BODY}`
    const headings = [
      h(2, 'quoted'),
      h(2, 'listed'),
      h(2, 'setext'),
      ...SECTION_HEADINGS
    ]

    expect(getReportNavSections(body, headings)).toHaveLength(2)
  })

  it('ignores `##` inside an intro code block', () => {
    const body = `<ReportIntro>\n\n\`\`\`\n## not a heading\n\`\`\`\n\n</ReportIntro>\n\n${SECTIONS_BODY}`

    expect(getReportNavSections(body, SECTION_HEADINGS)).toHaveLength(2)
  })

  it('keeps intro H3s out of the count, since the nav lists H2s only', () => {
    const body = `<ReportIntro>\n\n### Sub-heading\n\n</ReportIntro>\n\n${SECTIONS_BODY}`
    const headings = [h(3, 'sub-heading'), ...SECTION_HEADINGS]

    expect(getReportNavSections(body, headings).map((s) => s.id)).toEqual([
      'first-section',
      'second-section'
    ])
  })

  it('drops the footnotes landmark', () => {
    const headings = [...SECTION_HEADINGS, h(2, 'footnote-label', 'Footnotes')]

    expect(getReportNavSections(SECTIONS_BODY, headings)).toHaveLength(2)
  })

  it('returns an empty list for an empty body', () => {
    expect(getReportNavSections(undefined, [])).toEqual([])
  })
})
