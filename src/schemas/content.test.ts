import { describe, it, expect } from 'vitest'
import {
  foundationBlogFrontmatterSchema,
  grantPageFrontmatterSchema,
  podcastPageFrontmatterSchema
} from './content'

const base = {
  title: 'A post',
  description: 'A short description',
  date: '2025-01-01',
  pathSlug: 'a-post',
  categories: ['News']
}

describe('foundationBlogFrontmatterSchema', () => {
  it('accepts a minimal valid post and applies defaults', () => {
    const parsed = foundationBlogFrontmatterSchema.parse(base)

    expect(parsed.featured).toBe(false)
    expect(parsed.legacy).toBe(false)
    expect(parsed.relatedArticles).toEqual([])
    expect(parsed.lastUpdated).toBeUndefined()
    expect(parsed.date).toBeInstanceOf(Date)
  })

  it('coerces date and lastUpdated to Date', () => {
    const parsed = foundationBlogFrontmatterSchema.parse({
      ...base,
      lastUpdated: '2025-02-01'
    })

    expect(parsed.lastUpdated).toBeInstanceOf(Date)
  })

  it('rejects an unknown category', () => {
    const result = foundationBlogFrontmatterSchema.safeParse({
      ...base,
      categories: ['Not A Real Category']
    })

    expect(result.success).toBe(false)
  })

  it('rejects more than three related articles', () => {
    const result = foundationBlogFrontmatterSchema.safeParse({
      ...base,
      relatedArticles: ['one', 'two', 'three', 'four']
    })

    expect(result.success).toBe(false)
  })

  it('accepts an author with an optional link', () => {
    const parsed = foundationBlogFrontmatterSchema.parse({
      ...base,
      articleBios: [{ author: 'Jane', link: 'https://example.com' }]
    })

    expect(parsed.articleBios[0].link).toBe('https://example.com')
  })

  it('accepts a mobile feature image alongside the desktop one', () => {
    const parsed = foundationBlogFrontmatterSchema.parse({
      ...base,
      featureImage: '/desktop.jpg',
      featureImageMobile: '/mobile.jpg',
      featureImageMobileAlt: 'Mobile crop of the feature image'
    })

    expect(parsed.featureImageMobile).toBe('/mobile.jpg')
    expect(parsed.featureImageMobileAlt).toBe(
      'Mobile crop of the feature image'
    )
  })

  it('no longer accepts a pillar field as meaningful (ignored, not required)', () => {
    // pillar was removed; supplying it must not be required and must not break.
    const parsed = foundationBlogFrontmatterSchema.parse(base)
    expect('pillar' in parsed).toBe(false)
  })

  it('requires a title', () => {
    const result = foundationBlogFrontmatterSchema.safeParse({
      ...base,
      title: ''
    })

    expect(result.success).toBe(false)
  })
})

const podcastPageBase = {
  title: 'Podcasts',
  pathSlug: 'podcast',
  description: 'A short description of the podcast landing page.',
  titleCards: {
    columns: 'Three' as const,
    ariaLabel: 'Featured podcast series',
    cards: [
      {
        heading: 'Future Money',
        description: 'A podcast about the future of money.',
        secondaryCta: { text: 'Listen now', link: '/podcast' }
      }
    ]
  },
  podcasts: [
    {
      title: 'Episode one',
      description: 'The first episode.',
      url: 'https://podcast.interledger.org/@futuremoneypodcast/episodes/one/embed/light',
      series: 'Future Money' as const
    }
  ],
  ctaStrip: {
    heading: 'Listen now',
    description: 'Catch every episode.',
    buttonText: 'Listen',
    buttonLink: '/podcast'
  }
}

describe('podcastPageFrontmatterSchema', () => {
  it('accepts a minimal valid page', () => {
    const result = podcastPageFrontmatterSchema.safeParse(podcastPageBase)
    expect(result.success).toBe(true)
  })

  it('rejects a page with no title cards', () => {
    const result = podcastPageFrontmatterSchema.safeParse({
      ...podcastPageBase,
      titleCards: { ...podcastPageBase.titleCards, cards: [] }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a page with no podcasts', () => {
    const result = podcastPageFrontmatterSchema.safeParse({
      ...podcastPageBase,
      podcasts: []
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown series value', () => {
    const result = podcastPageFrontmatterSchema.safeParse({
      ...podcastPageBase,
      podcasts: [{ ...podcastPageBase.podcasts[0], series: 'Not A Series' }]
    })
    expect(result.success).toBe(false)
  })
})

describe('grantPageFrontmatterSchema, the ctaStrip secondary pair', () => {
  const grantPageBase = {
    title: 'A grant',
    pathSlug: 'a-grant',
    description: 'A short description',
    ctaStrip: {
      buttonText: 'Apply now',
      buttonLink: '/apply'
    }
  }

  // The secondary CTA is all or nothing everywhere else: the MDX handler, the
  // serializer, the renderer and the Strapi validator all need both halves.
  // Without this rule, half a pair validated here and was then dropped without
  // a word at render time.
  const withStrip = (strip: Record<string, unknown>) => ({
    ...grantPageBase,
    ctaStrip: { ...grantPageBase.ctaStrip, ...strip }
  })

  it('accepts a strip with no secondary CTA', () => {
    expect(grantPageFrontmatterSchema.safeParse(grantPageBase).success).toBe(
      true
    )
  })

  it('accepts both halves', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withStrip({
        secondaryButtonText: 'Learn more',
        secondaryButtonLink: '/about'
      })
    )
    expect(result.success).toBe(true)
  })

  it('rejects a text-only secondary, pointing at the link', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withStrip({ secondaryButtonText: 'Learn more' })
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([
      'ctaStrip',
      'secondaryButtonLink'
    ])
  })

  it('rejects a link-only secondary, pointing at the text', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withStrip({ secondaryButtonLink: '/about' })
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([
      'ctaStrip',
      'secondaryButtonText'
    ])
  })

  it('treats a whitespace-only half as empty, so it rejects the gap', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withStrip({
        secondaryButtonText: 'Learn more',
        secondaryButtonLink: '  '
      })
    )
    expect(result.success).toBe(false)
  })

  it('treats two whitespace-only halves as no secondary at all', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withStrip({ secondaryButtonText: '  ', secondaryButtonLink: '  ' })
    )
    expect(result.success).toBe(true)
  })
})

describe('grantPageFrontmatterSchema, the faqSection cta pair', () => {
  const grantPageBase = {
    title: 'A grant',
    pathSlug: 'a-grant',
    description: 'A short description',
    ctaStrip: {
      buttonText: 'Apply now',
      buttonLink: '/apply'
    }
  }

  // Same all-or-nothing rule as the ctaStrip secondary CTA above: the
  // renderer only shows the FAQ section's button when both ctaText and
  // ctaLink are present.
  const withFaqSection = (faqSection: Record<string, unknown>) => ({
    ...grantPageBase,
    faqSection: {
      title: 'FAQs',
      description: 'Common questions',
      items: [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' }
      ],
      ...faqSection
    }
  })

  it('accepts a faqSection with no cta', () => {
    expect(
      grantPageFrontmatterSchema.safeParse(withFaqSection({})).success
    ).toBe(true)
  })

  it('accepts both halves', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withFaqSection({ ctaText: 'Contact us', ctaLink: '/contact' })
    )
    expect(result.success).toBe(true)
  })

  it('rejects a text-only cta, pointing at the link', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withFaqSection({ ctaText: 'Contact us' })
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['faqSection', 'ctaLink'])
  })

  it('rejects a link-only cta, pointing at the text', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withFaqSection({ ctaLink: '/contact' })
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['faqSection', 'ctaText'])
  })

  it('treats a whitespace-only half as empty, so it rejects the gap', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withFaqSection({ ctaText: 'Contact us', ctaLink: '  ' })
    )
    expect(result.success).toBe(false)
  })

  it('treats two whitespace-only halves as no cta at all', () => {
    const result = grantPageFrontmatterSchema.safeParse(
      withFaqSection({ ctaText: '  ', ctaLink: '  ' })
    )
    expect(result.success).toBe(true)
  })
})
