import { describe, it, expect } from 'vitest'
import {
  serialize,
  sanitizeCardGridBlock,
  validateCardGrid
} from './card-grid.serializer'
import { SerializerFieldError } from '../../utils'

const titleCard = {
  __component: 'blocks.title-card',
  heading: 'Grant heading',
  description: 'Grant description.',
  secondaryCta: { link: '/grants/apply', text: 'Learn more' }
}

const infoCard = {
  __component: 'blocks.info-card',
  heading: 'Why apply',
  body: 'Open worldwide.'
}

const resourceCard = (heading: string) => ({
  __component: 'blocks.resource-card',
  heading,
  description: 'A resource description.',
  secondaryCta: {
    link: 'https://example.com/file.pdf',
    text: 'Download',
    document: true
  }
})

const navCard = {
  __component: 'blocks.navigation-card',
  heading: 'Next step',
  secondaryCta: { link: '/apply', text: 'Apply now' }
}

describe('card-grid serializer', () => {
  it('serializes a Title variant grid', () => {
    const result = serialize({
      ariaLabel: 'Grant options',
      variant: 'Title',
      columns: 'Two',
      cards: [titleCard]
    })

    expect(result).toContain(
      '<CardGrid ariaLabel="Grant options" variant="Title" columns="Two">'
    )
    expect(result).toContain('<TitleCard heading="Grant heading"')
    expect(result).toContain('</CardGrid>')
  })

  it('serializes Resource cards with document flag', () => {
    const result = serialize({
      ariaLabel: 'Resources',
      variant: 'Resource',
      columns: 'Two',
      cards: [resourceCard('One'), resourceCard('Two')]
    })

    expect(result).toContain('variant="Resource"')
    expect(result).toContain('<ResourceCard')
    expect(result).toContain('buttonDocument={true}')
  })

  it('serializes Info and Navigation variants', () => {
    expect(
      serialize({
        ariaLabel: 'Info',
        variant: 'Info',
        columns: 'Three',
        cards: [infoCard]
      })
    ).toContain('<InfoCard heading="Why apply">')

    expect(
      serialize({
        ariaLabel: 'Nav',
        variant: 'Navigation',
        columns: 'One',
        cards: [navCard]
      })
    ).toContain('<NavigationCard heading="Next step"')
  })

  it('rejects One column for non-Navigation variants', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Info',
        variant: 'Info',
        columns: 'One',
        cards: [infoCard]
      })
    ).toThrow(SerializerFieldError)
  })

  it('rejects Resource grids with fewer than two cards', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Resources',
        variant: 'Resource',
        columns: 'Two',
        cards: [resourceCard('Only')]
      })
    ).toThrow(SerializerFieldError)
  })

  it('rejects mismatched card components', () => {
    const errors = validateCardGrid({
      ariaLabel: 'Mix',
      variant: 'Info',
      columns: 'Two',
      cards: [titleCard]
    })
    expect(errors.some((e) => e.path.includes('__component'))).toBe(true)
  })

  it('ignores empty inactive variant fields when the active field is valid', () => {
    const errors = validateCardGrid({
      ariaLabel: 'Info only',
      variant: 'Info',
      columns: 'Three',
      infoCards: [infoCard],
      titleCards: [],
      resourceCards: [],
      navigationCards: []
    })
    expect(errors).toEqual([])
  })

  it('ignores incomplete cards left in inactive variant fields', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Info only',
        variant: 'Info',
        columns: 'Three',
        infoCards: [infoCard],
        titleCards: [{ heading: '' }],
        resourceCards: [{}],
        navigationCards: []
      })
    ).not.toThrow()
  })

  it('sanitizeCardGridBlock clears every field except the active variant', () => {
    const block = {
      variant: 'Navigation',
      titleCards: [titleCard],
      resourceCards: [resourceCard('A'), resourceCard('B')],
      infoCards: [infoCard],
      navigationCards: [navCard]
    }
    sanitizeCardGridBlock(block)
    expect(block.titleCards).toEqual([])
    expect(block.resourceCards).toEqual([])
    expect(block.infoCards).toEqual([])
    expect(block.navigationCards).toEqual([navCard])
  })

  it('sanitizeCardGridBlock adopts the only populated field when variant field is empty', () => {
    const block = {
      variant: 'Info',
      titleCards: [titleCard],
      resourceCards: [],
      infoCards: [],
      navigationCards: []
    }
    sanitizeCardGridBlock(block)
    expect(block.variant).toBe('Title')
    expect(block.titleCards).toEqual([titleCard])
    expect(block.infoCards).toEqual([])
  })

  it('sanitizeCardGridBlock throws instead of silently discarding cards when two variant fields are populated and neither matches the variant', () => {
    const block = {
      variant: 'Resource',
      titleCards: [titleCard],
      resourceCards: [],
      infoCards: [infoCard],
      navigationCards: []
    }
    expect(() => sanitizeCardGridBlock(block)).toThrow(SerializerFieldError)
    // Neither populated field was wiped before the error was raised.
    expect(block.titleCards).toEqual([titleCard])
    expect(block.infoCards).toEqual([infoCard])
  })

  it('serializes when cards are on a mismatched variant field', () => {
    const result = serialize({
      ariaLabel: 'Recovered',
      variant: 'Info',
      columns: 'Two',
      titleCards: [titleCard],
      infoCards: []
    })
    expect(result).toContain('variant="Title"')
    expect(result).toContain('<TitleCard heading="Grant heading"')
  })

  it('rejects external+document on the same CTA', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Nav',
        variant: 'Navigation',
        columns: 'One',
        cards: [
          {
            ...navCard,
            secondaryCta: {
              link: 'https://example.com',
              text: 'Go',
              external: true,
              document: true
            }
          }
        ]
      })
    ).toThrow(SerializerFieldError)
  })
})
