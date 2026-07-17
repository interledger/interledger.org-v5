import { escDouble as esc, escMdxBraces } from '../shared'

const TITLE_CARD_GRID_COLUMNS = ['Two', 'Three'] as const
type TitleCardGridColumns = (typeof TITLE_CARD_GRID_COLUMNS)[number]

function isTitleCardGridColumns(
  value: string | undefined
): value is TitleCardGridColumns {
  if (!value) return false
  return TITLE_CARD_GRID_COLUMNS.includes(value as TitleCardGridColumns)
}

interface TitleCard {
  heading?: string
  subHeading?: string
  description?: string
  secondaryCta?: {
    link?: string
    text?: string
    external?: boolean
  }
}

export function serialize(block: {
  columns?: string
  ariaLabel?: string
  titleCards?: TitleCard[]
}): string {
  // Strapi's `required`/`enum` constraints aren't enforced at save time
  if (!isTitleCardGridColumns(block.columns))
    throw new Error(
      `Title card grid columns must be one of ${TITLE_CARD_GRID_COLUMNS.join(', ')}. Received "${block.columns}".`
    )
  if (!block.ariaLabel || !block.ariaLabel.trim())
    throw new Error('Title card grid block is missing accessibility label')
  if (!Array.isArray(block.titleCards) || block.titleCards.length === 0)
    throw new Error('Title card grid block is missing title cards')

  const gridAttrs = ` ariaLabel="${esc(block.ariaLabel)}" columns="${esc(block.columns)}"`

  const cards = block.titleCards.map((card, index) => {
    const position = index + 1
    if (!card.heading || !card.heading.trim())
      throw new Error(`Title card ${position} is missing heading`)
    if (!card.description || !card.description.trim())
      throw new Error(`Title card ${position} is missing description`)
    if (!card.secondaryCta)
      throw new Error(
        `Title card ${position} is missing secondary call to action button`
      )
    if (!card.secondaryCta.link || !card.secondaryCta.link.trim())
      throw new Error(
        `Title card ${position} secondary call to action button is missing link`
      )
    if (
      !card.secondaryCta.external &&
      !card.secondaryCta.link.trim().startsWith('/')
    )
      throw new Error(
        `Title card ${position} secondary call to action button link must start with "/" for internal links`
      )
    if (!card.secondaryCta.text || !card.secondaryCta.text.trim())
      throw new Error(
        `Title card ${position} secondary call to action button is missing text`
      )

    const headingAttr = ` heading="${esc(card.heading)}"`
    const subheadingAttr = card.subHeading
      ? ` subheading="${esc(card.subHeading)}"`
      : ''
    const ctaAttrs = ` buttonUrl="${esc(card.secondaryCta.link)}" buttonText="${esc(card.secondaryCta.text)}" buttonExternal={${card.secondaryCta.external ?? false}}`

    const description = escMdxBraces(card.description)

    return `<TitleCard${headingAttr}${subheadingAttr}${ctaAttrs}>\n${description}\n  </TitleCard>`
  })

  return `<TitleCardGrid${gridAttrs}>\n  ${cards.join('\n  ')}\n</TitleCardGrid>`
}
