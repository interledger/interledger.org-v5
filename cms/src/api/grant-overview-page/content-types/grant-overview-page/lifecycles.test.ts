import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { generateGrantOverviewPageMDX } from './lifecycles'

describe('generateGrantOverviewPageMDX', () => {
  it('preserves non-Strapi hero frontmatter because grant overviews have no hero schema field', () => {
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
        heroTitle: 'Preserved Hero',
        heroDescription: 'This is not managed by Strapi for grant overviews.',
        heroImage: '/img/hero.jpg',
        metaDescription: 'Old SEO text'
      }
    )

    const parsed = matter(mdx)

    expect(parsed.data.heroTitle).toBe('Preserved Hero')
    expect(parsed.data.heroDescription).toBe(
      'This is not managed by Strapi for grant overviews.'
    )
    expect(parsed.data.heroImage).toBe('/img/hero.jpg')
    expect(parsed.data).not.toHaveProperty('metaDescription')
  })
})
