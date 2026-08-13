import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { generateGrantPageMDX } from './lifecycles'

describe('generateGrantPageMDX', () => {
  it('writes programOverview to frontmatter only, not into the MDX body', () => {
    const mdx = generateGrantPageMDX(
      {
        id: 1,
        documentId: 'grant-1',
        title: 'On-Campus Grant',
        pathSlug: 'education/on-campus',
        description: 'Funding for campus programmes.',
        locale: 'en',
        programOverview: '## Eligibility\n\n- Accredited institutions',
        ctaStrip: {
          heading: 'Apply now',
          description: 'Deadline approaching.',
          primaryButtonText: 'Start application',
          primaryButtonLink: 'https://example.com/apply',
          color: 'purple'
        }
      },
      {}
    )

    const parsed = matter(mdx)

    expect(parsed.data.programOverview).toBe(
      '## Eligibility\n\n- Accredited institutions'
    )
    expect(parsed.content).not.toContain('Eligibility')
  })

  it('clears stale programOverview frontmatter when Strapi has none for the entry', () => {
    const mdx = generateGrantPageMDX(
      {
        id: 1,
        documentId: 'grant-1',
        title: 'On-Campus Grant',
        pathSlug: 'education/on-campus',
        description: 'Funding for campus programmes.',
        locale: 'en',
        ctaStrip: {
          heading: 'Apply now',
          description: 'Deadline approaching.',
          primaryButtonText: 'Start application',
          primaryButtonLink: 'https://example.com/apply',
          color: 'purple'
        }
      },
      { programOverview: '## Stale overview, removed in Strapi' }
    )

    const parsed = matter(mdx)

    expect(parsed.data.programOverview).toBeUndefined()
    expect(parsed.data.ctaStrip.color).toBeUndefined()
  })

  it('omits subtitle/ctaText/ctaLink from faqSection frontmatter when absent, rather than writing empty strings', () => {
    const mdx = generateGrantPageMDX(
      {
        id: 1,
        documentId: 'grant-1',
        title: 'On-Campus Grant',
        pathSlug: 'education/on-campus',
        description: 'Funding for campus programmes.',
        locale: 'en',
        faqSection: {
          title: 'Common Questions',
          description: 'We are happy to help.',
          items: [
            {
              question: 'Who can apply?',
              answer: 'Any accredited institution.'
            },
            { question: 'How much funding?', answer: 'Up to $50,000.' }
          ]
        },
        ctaStrip: {
          heading: 'Apply now',
          description: 'Deadline approaching.',
          primaryButtonText: 'Start application',
          primaryButtonLink: 'https://example.com/apply',
          color: 'purple'
        }
      },
      {}
    )

    const parsed = matter(mdx)

    expect(parsed.data.faqSection.title).toBe('Common Questions')
    expect(parsed.data.faqSection.description).toBe('We are happy to help.')
    expect(parsed.data.faqSection.subtitle).toBeUndefined()
    expect(parsed.data.faqSection.ctaText).toBeUndefined()
    expect(parsed.data.faqSection.ctaLink).toBeUndefined()
  })
})
