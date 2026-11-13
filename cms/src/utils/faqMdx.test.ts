import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { generateFaqMdx, type FaqMdxInput } from './faqMdx'

function makeFaq(overrides: Partial<FaqMdxInput> = {}): FaqMdxInput {
  return {
    title: 'FAQ',
    pathSlug: 'faq',
    section: 'foundation',
    heading: 'Frequently asked questions',
    description: 'Answers to common questions.',
    faqSections: [
      { heading: 'General', items: [{ question: 'Why?', answer: 'Because.' }] }
    ],
    locale: 'en',
    ...overrides
  }
}

describe('generateFaqMdx — draft', () => {
  it('writes draft: true when the box is checked', () => {
    const mdx = generateFaqMdx(makeFaq({ draft: true }))

    expect(matter(mdx).data.draft).toBe(true)
  })

  it('omits draft when the box is unchecked', () => {
    const mdx = generateFaqMdx(makeFaq({ draft: false }))

    expect(matter(mdx).data).not.toHaveProperty('draft')
  })
})
