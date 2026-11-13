import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { serialize } from '../../src/serializers/blocks/donation-cards.serializer'

import './donationCardsHandler'

const ctx: ParserContext = { locale: 'en' }

const fullCard = {
  heading: 'Founding Sustaining Members',
  amount: '$10/month or $100 annually',
  summary: 'A recurring gift that grows our community, one member at a time.',
  seats: '50 of 50 seats available',
  benefitsLabel: 'Benefits',
  benefits: 'An exclusive swag pack and additional unique benefits.',
  ctaText: 'Donate',
  ctaLink: '#XVSHSPQU'
}

describe('DonationCards round-trip (serialize → parse)', () => {
  it('round-trips a card with every field set', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({ ariaLabel: 'Membership tiers', cards: [fullCard] }),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.donation-cards',
        ariaLabel: 'Membership tiers',
        cards: [fullCard]
      }
    ])
  })

  it('keeps a sparse card sparse rather than adding empty fields', async () => {
    const sparse = {
      heading: 'Founding Visionaries',
      amount: 'A gift of $25,000 or more',
      benefits: 'Unique engagement opportunities tailored to your interest.',
      ctaText: 'Schedule a meeting',
      ctaLink: 'https://meetings-eu1.hubspot.com/jesse-ward'
    }

    const blocks = await parseMdxToBlocks(
      serialize({
        ariaLabel: 'Membership tiers',
        cards: [{ ...sparse, summary: null, seats: '   ' }]
      }),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.donation-cards',
        ariaLabel: 'Membership tiers',
        cards: [sparse]
      }
    ])
  })

  it('round-trips an external CTA flag', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        ariaLabel: 'Membership tiers',
        cards: [{ ...fullCard, ctaExternal: true, ctaDocument: false }]
      }),
      ctx
    )

    expect(blocks[0]).toMatchObject({
      cards: [{ ctaExternal: true }]
    })
    expect(blocks[0]).not.toHaveProperty('cards.0.ctaDocument')
  })

  it('round-trips several cards in order', async () => {
    const second = { ...fullCard, heading: 'Founding Champions' }
    const blocks = await parseMdxToBlocks(
      serialize({ ariaLabel: 'Membership tiers', cards: [fullCard, second] }),
      ctx
    )

    expect(blocks[0]).toMatchObject({
      cards: [
        { heading: 'Founding Sustaining Members' },
        { heading: 'Founding Champions' }
      ]
    })
  })
})

describe('DonationCards serializer guards', () => {
  it('refuses a block with no ariaLabel', () => {
    expect(() => serialize({ cards: [fullCard] })).toThrow(/ariaLabel/)
  })

  it('refuses a block with no cards', () => {
    expect(() => serialize({ ariaLabel: 'Tiers', cards: [] })).toThrow(
      /at least 1 card/
    )
  })

  it('names the card that is missing a required field', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Tiers',
        cards: [fullCard, { ...fullCard, ctaLink: '  ' }]
      })
    ).toThrow(/card 2 is missing a CTA link/)
  })

  it('refuses a card that is both external and a document', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Tiers',
        cards: [fullCard, { ...fullCard, ctaExternal: true, ctaDocument: true }]
      })
    ).toThrow(/card 2 cannot be both external and document/)
  })
})

describe('DonationCards parser guards', () => {
  it('rejects a card missing a required field', async () => {
    const result = await parseMdxToBlocks(
      `<DonationCards ariaLabel="Tiers" cards={[{ heading: 'Tier', amount: '$1' }]} />`,
      ctx
    )

    expect(result).toBeInstanceOf(Error)
    expect(String(result)).toMatch(/cards/)
  })

  it('rejects a block without ariaLabel', async () => {
    const result = await parseMdxToBlocks(
      `<DonationCards cards={${JSON.stringify([fullCard])}} />`,
      ctx
    )

    expect(result).toBeInstanceOf(Error)
  })

  it('rejects a card that is both external and a document', async () => {
    const result = await parseMdxToBlocks(
      `<DonationCards ariaLabel="Tiers" cards={${JSON.stringify([
        fullCard,
        { ...fullCard, ctaExternal: true, ctaDocument: true }
      ])}} />`,
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'cards',
      message: expect.stringContaining(
        'Card 2 cannot be both external and document'
      )
    })
  })
})
