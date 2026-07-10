import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { generateFaqMdx, type FaqMdxInput } from './faqMdx'

function makeFaq(overrides: Partial<FaqMdxInput> = {}): FaqMdxInput {
  return {
    title: 'On-Campus Financial Education Grant FAQ',
    pathSlug: 'grant/education/on-campus/faq',
    section: 'foundation',
    description: 'Answers to common questions about the grant.',
    heading: 'Frequently Asked Questions',
    locale: 'en',
    ...overrides
  }
}

describe('generateFaqMdx', () => {
  it('writes core frontmatter fields and an empty body', () => {
    const mdx = generateFaqMdx(makeFaq())
    const { data, content } = matter(mdx)

    expect(data.title).toBe('On-Campus Financial Education Grant FAQ')
    expect(data.pathSlug).toBe('grant/education/on-campus/faq')
    expect(data.section).toBe('foundation')
    expect(data.description).toBe(
      'Answers to common questions about the grant.'
    )
    expect(data.heading).toBe('Frequently Asked Questions')
    expect(data.locale).toBe('en')
    expect(content.trim()).toBe('')
  })

  it('writes introParagraph to frontmatter when provided', () => {
    const { data } = matter(
      generateFaqMdx(
        makeFaq({ introParagraph: 'A short intro to the FAQ.' })
      )
    )
    expect(data.introParagraph).toBe('A short intro to the FAQ.')
  })

  it('writes introParagraph as null when absent', () => {
    const { data } = matter(generateFaqMdx(makeFaq()))
    expect(data.introParagraph).toBeNull()
  })

  it('adds localizes for a non-default locale, using the English slug', () => {
    const { data } = matter(
      generateFaqMdx(
        makeFaq({
          locale: 'es',
          pathSlug: 'grant/education/on-campus/preguntas-frecuentes'
        }),
        'grant/education/on-campus/faq'
      )
    )
    expect(data.locale).toBe('es')
    expect(data.localizes).toBe('grant/education/on-campus/faq')
  })

  it('does not add localizes for the default locale', () => {
    const { data } = matter(generateFaqMdx(makeFaq()))
    expect(data.localizes).toBeUndefined()
  })
})
