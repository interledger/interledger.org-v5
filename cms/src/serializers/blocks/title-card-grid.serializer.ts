import { escDouble as esc, escMdxBraces } from '../shared'
import { SerializerFieldError, type FieldError } from '../../utils'

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

/**
 * Validate a single title card. Returns every failing field for this card
 * so an editor sees all of them at once, not just the first.
 */
function validateTitleCard(card: TitleCard, index: number): FieldError[] {
  const position = index + 1
  const fieldErrors: FieldError[] = []

  if (!card.heading || !card.heading.trim())
    fieldErrors.push({
      message: `Title card ${position} is missing heading`,
      path: ['titleCards', index, 'heading']
    })
  if (!card.description || !card.description.trim())
    fieldErrors.push({
      message: `Title card ${position} is missing description`,
      path: ['titleCards', index, 'description']
    })

  if (!card.secondaryCta) {
    fieldErrors.push({
      message: `Title card ${position} is missing secondary call to action button`,
      path: ['titleCards', index, 'secondaryCta']
    })
    // Nothing further to check without a secondaryCta to look inside.
    return fieldErrors
  }

  if (!card.secondaryCta.link || !card.secondaryCta.link.trim()) {
    fieldErrors.push({
      message: `Title card ${position} secondary call to action button is missing link`,
      path: ['titleCards', index, 'secondaryCta', 'link']
    })
  } else if (
    !card.secondaryCta.external &&
    !card.secondaryCta.link.startsWith('/')
  ) {
    fieldErrors.push({
      message: `Title card ${position} secondary call to action button link must start with "/" for internal links`,
      path: ['titleCards', index, 'secondaryCta', 'link']
    })
  }
  if (!card.secondaryCta.text || !card.secondaryCta.text.trim())
    fieldErrors.push({
      message: `Title card ${position} secondary call to action button is missing text`,
      path: ['titleCards', index, 'secondaryCta', 'text']
    })

  return fieldErrors
}

/**
 * Validate the whole grid. Returns every failing field across the grid
 * itself and all of its cards, so an editor can fix everything in one pass.
 */
function validateTitleCardGrid(block: {
  columns?: string
  ariaLabel?: string
  titleCards?: TitleCard[]
}): FieldError[] {
  const fieldErrors: FieldError[] = []

  // Strapi's `required`/`enum` constraints aren't enforced at save time
  if (!isTitleCardGridColumns(block.columns))
    fieldErrors.push({
      message: `Title card grid columns must be one of ${TITLE_CARD_GRID_COLUMNS.join(', ')}. Received "${block.columns}".`,
      path: ['columns']
    })
  if (!block.ariaLabel || !block.ariaLabel.trim())
    fieldErrors.push({
      message: 'Title card grid block is missing accessibility label',
      path: ['ariaLabel']
    })
  if (!Array.isArray(block.titleCards) || block.titleCards.length === 0) {
    fieldErrors.push({
      message: 'Title card grid block is missing title cards',
      path: ['titleCards']
    })
    // Nothing further to check without a titleCards array to look inside.
    return fieldErrors
  }

  block.titleCards.forEach((card, index) => {
    fieldErrors.push(...validateTitleCard(card, index))
  })

  return fieldErrors
}

export function serialize(block: {
  columns?: string
  ariaLabel?: string
  titleCards?: TitleCard[]
}): string {
  const fieldErrors = validateTitleCardGrid(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  // Validation above guarantees these fields are present from here on.
  const gridAttrs = ` ariaLabel="${esc(block.ariaLabel)}" columns="${esc(block.columns)}"`

  const cards = block.titleCards.map((card) => {
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
