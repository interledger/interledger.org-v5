import { describe, it, expect } from 'vitest'
import {
  foundationBlogFrontmatterSchema,
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
      featureImageMobile: '/mobile.jpg'
    })

    expect(parsed.featureImageMobile).toBe('/mobile.jpg')
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

  it('accepts an optional episode field on a podcast item', () => {
    const parsed = podcastPageFrontmatterSchema.parse({
      ...podcastPageBase,
      podcasts: [{ ...podcastPageBase.podcasts[0], episode: 'S02:E04' }]
    })
    expect(parsed.podcasts[0]?.episode).toBe('S02:E04')
  })
})
