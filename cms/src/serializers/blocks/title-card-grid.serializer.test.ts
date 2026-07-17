import { describe, it, expect } from 'vitest'
import { serialize } from './title-card-grid.serializer'

const validCard = {
  heading: 'Grant heading',
  description: 'Grant description.',
  secondaryCta: { link: '/grants/apply', text: 'Learn more' }
}

describe('title-card-grid serializer', () => {
  it('serializes a grid with a single card', () => {
    const result = serialize({
      columns: 'Two',
      ariaLabel: 'Grant options',
      titleCards: [validCard]
    })

    expect(result).toContain(
      '<TitleCardGrid ariaLabel="Grant options" columns="Two">'
    )
    expect(result).toContain('<TitleCard heading="Grant heading"')
    expect(result).toContain(
      'buttonUrl="/grants/apply" buttonText="Learn more" buttonExternal={false}'
    )
    expect(result).toContain('Grant description.')
    expect(result).toContain('</TitleCardGrid>')
  })

  it('includes subheading when provided', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [{ ...validCard, subHeading: 'A subheading' }]
    })

    expect(result).toContain('subheading="A subheading"')
  })

  it('omits subheading when not provided', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [validCard]
    })

    expect(result).not.toContain('subheading=')
  })

  it('reflects an external secondary CTA', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [
        {
          ...validCard,
          secondaryCta: {
            link: 'https://example.com',
            text: 'Learn more',
            external: true
          }
        }
      ]
    })

    expect(result).toContain('buttonUrl="https://example.com"')
    expect(result).toContain('buttonExternal={true}')
  })

  it('serializes multiple cards in order', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [
        { ...validCard, heading: 'First' },
        { ...validCard, heading: 'Second' }
      ]
    })

    const firstIndex = result.indexOf('First')
    const secondIndex = result.indexOf('Second')
    expect(firstIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(firstIndex)
  })

  it('escapes attribute values', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'A & B',
      titleCards: [{ ...validCard, heading: 'C > D' }]
    })

    expect(result).toContain('ariaLabel="A &amp; B"')
    expect(result).toContain('heading="C &gt; D"')
  })

  it('escapes MDX braces in description', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [{ ...validCard, description: 'Use {curly} braces.' }]
    })

    expect(result).toContain('Use \\{curly\\} braces.')
  })

  it('throws when columns is missing', () => {
    expect(() =>
      serialize({ ariaLabel: 'Grant options', titleCards: [validCard] })
    ).toThrow(
      'Title card grid columns must be one of Two, Three. Received "undefined".'
    )
  })

  it('throws when columns is not a valid enum value', () => {
    expect(() =>
      serialize({
        columns: 'Four',
        ariaLabel: 'Grant options',
        titleCards: [validCard]
      })
    ).toThrow(
      'Title card grid columns must be one of Two, Three. Received "Four".'
    )
  })

  it('throws when ariaLabel is missing', () => {
    expect(() =>
      serialize({ columns: 'Three', titleCards: [validCard] })
    ).toThrow('Title card grid block is missing accessibility label')
  })

  it('throws when ariaLabel is whitespace only', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: '   ',
        titleCards: [validCard]
      })
    ).toThrow('Title card grid block is missing accessibility label')
  })

  it('throws when titleCards is missing', () => {
    expect(() =>
      serialize({ columns: 'Three', ariaLabel: 'Grant options' })
    ).toThrow('Title card grid block is missing title cards')
  })

  it('throws when titleCards is empty', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: []
      })
    ).toThrow('Title card grid block is missing title cards')
  })

  it('throws when a card is missing a heading', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, heading: undefined }]
      })
    ).toThrow('Title card 1 is missing heading')
  })

  it('throws when a card heading is whitespace only', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, heading: '   ' }]
      })
    ).toThrow('Title card 1 is missing heading')
  })

  it('throws when a card is missing a description', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, description: undefined }]
      })
    ).toThrow('Title card 1 is missing description')
  })

  it('throws when a card description is whitespace only', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, description: '   ' }]
      })
    ).toThrow('Title card 1 is missing description')
  })

  it('throws when a card is missing a secondaryCta', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, secondaryCta: undefined }]
      })
    ).toThrow('Title card 1 is missing secondary call to action button')
  })

  it('throws when a secondaryCta is missing a link', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [{ ...validCard, secondaryCta: { text: 'Learn more' } }]
      })
    ).toThrow('Title card 1 secondary call to action button is missing link')
  })

  it('throws when a secondaryCta link is whitespace only', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [
          { ...validCard, secondaryCta: { link: '   ', text: 'Learn more' } }
        ]
      })
    ).toThrow('Title card 1 secondary call to action button is missing link')
  })

  it('throws when a secondaryCta is missing text', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [
          {
            ...validCard,
            secondaryCta: { link: '/grants/apply' }
          }
        ]
      })
    ).toThrow('Title card 1 secondary call to action button is missing text')
  })

  it('throws when a secondaryCta text is whitespace only', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [
          {
            ...validCard,
            secondaryCta: { link: '/grants/apply', text: '   ' }
          }
        ]
      })
    ).toThrow('Title card 1 secondary call to action button is missing text')
  })

  it('throws when a non-external secondaryCta link does not start with "/"', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [
          {
            ...validCard,
            secondaryCta: { link: 'grants/apply', text: 'Learn more' }
          }
        ]
      })
    ).toThrow(
      'Title card 1 secondary call to action button link must start with "/" for internal links'
    )
  })

  it('throws when a non-external secondaryCta link is a full URL', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [
          {
            ...validCard,
            secondaryCta: { link: 'https://example.com', text: 'Learn more' }
          }
        ]
      })
    ).toThrow(
      'Title card 1 secondary call to action button link must start with "/" for internal links'
    )
  })

  it('allows a full URL when the secondaryCta is marked external', () => {
    const result = serialize({
      columns: 'Three',
      ariaLabel: 'Grant options',
      titleCards: [
        {
          ...validCard,
          secondaryCta: {
            link: 'https://example.com',
            text: 'Learn more',
            external: true
          }
        }
      ]
    })

    expect(result).toContain('buttonUrl="https://example.com"')
  })

  it('reports the correct 1-based index for a later card', () => {
    expect(() =>
      serialize({
        columns: 'Three',
        ariaLabel: 'Grant options',
        titleCards: [validCard, { ...validCard, heading: undefined }]
      })
    ).toThrow('Title card 2 is missing heading')
  })
})
