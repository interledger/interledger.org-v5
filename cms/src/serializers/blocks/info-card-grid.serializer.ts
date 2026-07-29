import { escDouble as esc, escMdxBraces } from '../shared'
import { SerializerFieldError, type FieldError } from '../../utils'

const INFO_CARD_GRID_COLUMNS = ['Two', 'Three'] as const
type InfoCardGridColumns = (typeof INFO_CARD_GRID_COLUMNS)[number]

function isInfoCardGridColumns(
  value: string | undefined
): value is InfoCardGridColumns {
  if (!value) return false
  return INFO_CARD_GRID_COLUMNS.includes(value as InfoCardGridColumns)
}

interface InfoCard {
  heading?: string
  body?: string
}

function validateInfoCard(card: InfoCard, index: number): FieldError[] {
  const position = index + 1
  const fieldErrors: FieldError[] = []

  if (!card.heading?.trim()) {
    fieldErrors.push({
      message: `Info card ${position} is missing heading`,
      path: ['cards', index, 'heading']
    })
  }
  if (!card.body?.trim()) {
    fieldErrors.push({
      message: `Info card ${position} is missing description`,
      path: ['cards', index, 'body']
    })
  }

  return fieldErrors
}

function validateInfoCardGrid(block: {
  ariaLabel?: string
  columns?: string
  cards?: InfoCard[]
}): FieldError[] {
  const fieldErrors: FieldError[] = []

  if (!block.ariaLabel?.trim()) {
    fieldErrors.push({
      message: 'Info card grid block is missing accessibility label',
      path: ['ariaLabel']
    })
  }
  if (!isInfoCardGridColumns(block.columns)) {
    fieldErrors.push({
      message: `Info card grid columns must be one of ${INFO_CARD_GRID_COLUMNS.join(', ')}. Received "${block.columns}".`,
      path: ['columns']
    })
  }
  if (!Array.isArray(block.cards) || block.cards.length === 0) {
    fieldErrors.push({
      message: 'Info card grid block is missing cards',
      path: ['cards']
    })
    return fieldErrors
  }

  block.cards.forEach((card, index) => {
    fieldErrors.push(...validateInfoCard(card, index))
  })

  return fieldErrors
}

export function serialize(block: {
  ariaLabel?: string
  columns?: string
  cards?: InfoCard[]
}): string {
  const fieldErrors = validateInfoCardGrid(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  // Validation above guarantees these fields are present from here on.
  const gridAttrs = ` ariaLabel="${esc(block.ariaLabel)}" columns="${esc(block.columns)}"`

  const cards = block.cards.map((card) => {
    // Blank lines around the body so MDX treats list markers as markdown
    // inside the JSX child, not as broken tag structure.
    const body = escMdxBraces(card.body!)
    return `<InfoCard heading="${esc(card.heading)}">\n\n${body}\n\n</InfoCard>`
  })

  return `<InfoCards${gridAttrs}>\n${cards.join('\n')}\n</InfoCards>`
}
