import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { generatePodcastPageMdx, type PodcastPageInput } from './podcastPageMdx'

function makePage(overrides: Partial<PodcastPageInput> = {}): PodcastPageInput {
  return {
    title: 'Podcasts',
    pathSlug: 'podcast',
    description: 'A short description of the podcast landing page.',
    titleCards: {
      columns: 'Three',
      ariaLabel: 'Featured podcast series',
      titleCards: [
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
        series: 'Future Money'
      }
    ],
    ctaStrip: {
      heading: 'Listen now',
      description: 'Catch every episode.',
      primaryButtonText: 'Listen',
      primaryButtonLink: '/podcast'
    },
    locale: 'en',
    ...overrides
  }
}

describe('generatePodcastPageMdx', () => {
  it('writes core frontmatter fields with no body', () => {
    const { data, content } = matter(generatePodcastPageMdx(makePage()))

    expect(data.title).toBe('Podcasts')
    expect(data.pathSlug).toBe('podcast')
    expect(data.description).toBe(
      'A short description of the podcast landing page.'
    )
    expect(data.locale).toBe('en')
    expect(content.trim()).toBe('')
  })

  it('flattens titleCards into a columns/ariaLabel/cards object', () => {
    const { data } = matter(generatePodcastPageMdx(makePage()))
    const titleCards = data.titleCards as {
      columns: string
      ariaLabel: string
      cards: Array<{ heading: string; description: string }>
    }

    expect(titleCards.columns).toBe('Three')
    expect(titleCards.ariaLabel).toBe('Featured podcast series')
    expect(titleCards.cards).toHaveLength(1)
    expect(titleCards.cards[0]?.heading).toBe('Future Money')
  })

  it('flattens podcasts', () => {
    const { data } = matter(generatePodcastPageMdx(makePage()))
    const podcasts = data.podcasts as Array<{
      title: string
      series: string
    }>

    expect(podcasts).toHaveLength(1)
    expect(podcasts[0]?.title).toBe('Episode one')
    expect(podcasts[0]?.series).toBe('Future Money')
  })

  // Strips are purple only, so there is no colour field to write. #458 took
  // `color` off the component but left this export still emitting it, which
  // made Strapi reject every podcast sync with "Invalid key color at
  // ctaStrip". Assert it is gone, so nothing puts it back.
  it('flattens ctaStrip and writes no colour field', () => {
    const { data } = matter(generatePodcastPageMdx(makePage()))
    const ctaStrip = data.ctaStrip as {
      heading: string
      buttonText: string
      buttonLink: string
    }

    expect(ctaStrip.heading).toBe('Listen now')
    expect(ctaStrip.buttonText).toBe('Listen')
    expect(ctaStrip.buttonLink).toBe('/podcast')
    expect(ctaStrip).not.toHaveProperty('color')
  })

  it('writes the secondary CTA only when both halves are set', () => {
    const both = matter(
      generatePodcastPageMdx(
        makePage({
          ctaStrip: {
            heading: 'Listen now',
            primaryButtonText: 'Listen',
            primaryButtonLink: '/podcast',
            secondaryButtonText: 'See all episodes',
            secondaryButtonLink: '/podcast/all'
          }
        })
      )
    ).data.ctaStrip as Record<string, unknown>

    expect(both.secondaryButtonText).toBe('See all episodes')
    expect(both.secondaryButtonLink).toBe('/podcast/all')

    const halfOnly = matter(
      generatePodcastPageMdx(
        makePage({
          ctaStrip: {
            heading: 'Listen now',
            primaryButtonText: 'Listen',
            primaryButtonLink: '/podcast',
            secondaryButtonText: 'See all episodes'
          }
        })
      )
    ).data.ctaStrip as Record<string, unknown>

    expect(halfOnly).not.toHaveProperty('secondaryButtonText')
    expect(halfOnly).not.toHaveProperty('secondaryButtonLink')
  })

  it('adds localizes for a non-default locale, using the English slug', () => {
    const { data } = matter(
      generatePodcastPageMdx(makePage({ locale: 'es' }), 'podcast')
    )
    expect(data.locale).toBe('es')
    expect(data.localizes).toBe('podcast')
  })

  it('does not add localizes for the default locale', () => {
    const { data } = matter(generatePodcastPageMdx(makePage()))
    expect(data.localizes).toBeUndefined()
  })
})
