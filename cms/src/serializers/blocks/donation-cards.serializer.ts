/**
 * Serialize blocks.donation-cards → MDX.
 *
 * Inverse of donationCardsHandler. Optional fields are emitted only when set,
 * so a card an editor left sparse round-trips as the same sparse card rather
 * than gaining empty strings. Booleans are emitted only when true, matching
 * how CtaButtons writes `external`/`document`.
 */
export function serialize(block: {
  ariaLabel?: string | null
  cards?: {
    heading?: string | null
    amount?: string | null
    summary?: string | null
    seats?: string | null
    benefitsLabel?: string | null
    benefits?: string | null
    ctaText?: string | null
    ctaLink?: string | null
    ctaExternal?: boolean | null
    ctaDocument?: boolean | null
  }[]
}): string {
  const ariaLabel = block.ariaLabel?.trim()
  if (!ariaLabel) {
    throw new Error('Donation Cards block is missing an ariaLabel')
  }

  // Strapi's `required: true` isn't enforced at save time, so every field a
  // card cannot render without is checked here rather than trusted.
  if (!block.cards || block.cards.length === 0) {
    throw new Error('Donation Cards block requires at least 1 card')
  }

  const cardItems = block.cards.map((card, i) => {
    const required = (value: string | null | undefined, field: string) => {
      const trimmed = value?.trim()
      if (!trimmed) {
        throw new Error(
          `Donation Cards block: card ${i + 1} is missing ${field}`
        )
      }
      return trimmed
    }

    const summary = card.summary?.trim()
    const seats = card.seats?.trim()
    const benefitsLabel = card.benefitsLabel?.trim()

    return {
      heading: required(card.heading, 'a heading'),
      amount: required(card.amount, 'an amount'),
      ...(summary ? { summary } : {}),
      ...(seats ? { seats } : {}),
      ...(benefitsLabel ? { benefitsLabel } : {}),
      benefits: required(card.benefits, 'benefits'),
      ctaText: required(card.ctaText, 'CTA text'),
      ctaLink: required(card.ctaLink, 'a CTA link'),
      ...(card.ctaExternal ? { ctaExternal: true } : {}),
      ...(card.ctaDocument ? { ctaDocument: true } : {})
    }
  })

  const ariaLabelAttr = ` ariaLabel=${JSON.stringify(ariaLabel)}`
  const cardsAttr = ` cards={${JSON.stringify(cardItems)}}`

  return `<DonationCards${ariaLabelAttr}${cardsAttr} />`
}
