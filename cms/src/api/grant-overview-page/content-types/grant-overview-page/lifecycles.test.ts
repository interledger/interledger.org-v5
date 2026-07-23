import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { generateGrantOverviewPageMDX } from './lifecycles'

describe('generateGrantOverviewPageMDX', () => {
  it('clears stale hero frontmatter when Strapi has no hero for the entry', () => {
    const mdx = generateGrantOverviewPageMDX(
      {
        id: 1,
        documentId: 'overview-1',
        title: 'Digital Finance',
        pathSlug: 'digital-finance',
        description: 'Funding for digital finance work.',
        locale: 'en',
        ctaStrip: {
          heading: 'Ready?',
          description: 'Apply now.',
          primaryButtonText: 'Apply',
          primaryButtonLink: '/apply',
          color: 'purple'
        }
      },
      {
        heroTitle: 'Stale Hero',
        heroDescription:
          'Left over from before the hero was removed in Strapi.',
        heroImage: '/img/hero.jpg'
      }
    )

    const parsed = matter(mdx)

    expect(parsed.data.heroTitle).toBeUndefined()
    expect(parsed.data.heroDescription).toBeUndefined()
    expect(parsed.data.heroImage).toBeUndefined()
  })

  it('writes followUpContent to frontmatter instead of the MDX body', () => {
    const mdx = generateGrantOverviewPageMDX(
      {
        id: 1,
        documentId: 'overview-1',
        title: 'Our grantmaking',
        pathSlug: 'our-grantmaking',
        description: 'Funding overview.',
        locale: 'en',
        followUpContent:
          '## Contact our Programs Team\n\nEmail [programteam@interledger.org](mailto:programteam@interledger.org)',
        ctaStrip: {
          heading: 'Get involved',
          description: 'Stay in touch.',
          primaryButtonText: 'Subscribe',
          primaryButtonLink: '/subscribe',
          color: 'green'
        }
      },
      {}
    )

    const parsed = matter(mdx)

    expect(parsed.data.followUpContent).toContain('Contact our Programs Team')
    expect(parsed.content.trim()).toBe('')
  })
})
