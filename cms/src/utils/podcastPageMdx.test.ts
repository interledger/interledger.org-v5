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

  // Strips are purple only, so there is no colour field to write. #481 took
  // `color` back off this export. Assert it stays gone, so nothing puts it
  // back and breaks the podcast sync again.
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

  it('converts textSection through ckeditorFieldToMarkdown when present', () => {
    const { data } = matter(
      generatePodcastPageMdx(
        makePage({ textSection: '<p>Hello <strong>world</strong></p>' })
      )
    )

    expect(data.textSection).toBe('Hello **world**')
  })

  it('omits textSection when absent', () => {
    const { data } = matter(generatePodcastPageMdx(makePage()))
    expect(data).not.toHaveProperty('textSection')
  })

  it('converts a CKEditor <br>/<br><br> in textSection to \\n/\\n\\n', () => {
    const { data } = matter(
      generatePodcastPageMdx(
        makePage({
          textSection: 'Soft break<br />then a real break<br /><br />after it'
        })
      )
    )

    expect(data.textSection).toBe('Soft break\nthen a real break\n\nafter it')
  })

  it('converts a CKEditor <br>/<br><br> in a title card description', () => {
    const { data } = matter(
      generatePodcastPageMdx(
        makePage({
          titleCards: {
            columns: 'Three',
            ariaLabel: 'Featured podcast series',
            titleCards: [
              {
                heading: 'Future Money',
                description: 'One<br />Two<br /><br />Three',
                secondaryCta: { text: 'Listen now', link: '/podcast' }
              }
            ]
          }
        })
      )
    )
    const titleCards = data.titleCards as {
      cards: Array<{ description: string }>
    }

    expect(titleCards.cards[0]?.description).toBe('One\nTwo\n\nThree')
  })

  it('converts a CKEditor <br>/<br><br> in ctaStrip.description', () => {
    const { data } = matter(
      generatePodcastPageMdx(
        makePage({
          ctaStrip: {
            heading: 'Listen now',
            description: 'One<br />Two<br /><br />Three',
            primaryButtonText: 'Listen',
            primaryButtonLink: '/podcast'
          }
        })
      )
    )
    const ctaStrip = data.ctaStrip as { description: string }

    expect(ctaStrip.description).toBe('One\nTwo\n\nThree')
  })

  // Turndown escapes a literal underscore as `\_` so markdown renderers
  // don't misread it as emphasis. This locks in that yaml.dump/gray-matter
  // round-trips a multi-paragraph value containing that escape correctly.
  it('round-trips an escaped underscore across paragraphs without corrupting it', () => {
    const { data } = matter(
      generatePodcastPageMdx(
        makePage({
          textSection:
            '<p>Sub_scribe to our podcast.</p><p>your_favorite platform now.</p>'
        })
      )
    )

    expect(data.textSection).toBe(
      'Sub\\_scribe to our podcast.\n\nyour\\_favorite platform now.'
    )
  })
})
