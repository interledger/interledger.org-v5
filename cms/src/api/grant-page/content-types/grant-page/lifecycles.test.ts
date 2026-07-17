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
  })
})
