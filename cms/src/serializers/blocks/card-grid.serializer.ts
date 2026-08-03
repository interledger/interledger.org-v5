import { escDouble as esc, escMdxBraces } from '../shared'
import { SerializerFieldError, type FieldError } from '../../utils'

export const CARD_GRID_VARIANTS = [
  'Title',
  'Resource',
  'Info',
  'Navigation'
] as const
export type CardGridVariant = (typeof CARD_GRID_VARIANTS)[number]

export const CARD_GRID_COLUMNS = ['One', 'Two', 'Three'] as const
export type CardGridColumns = (typeof CARD_GRID_COLUMNS)[number]

export const VARIANT_CARDS_FIELD: Record<
  CardGridVariant,
  'titleCards' | 'resourceCards' | 'infoCards' | 'navigationCards'
> = {
  Title: 'titleCards',
  Resource: 'resourceCards',
  Info: 'infoCards',
  Navigation: 'navigationCards'
}

const VARIANT_COMPONENT: Record<CardGridVariant, string> = {
  Title: 'blocks.title-card',
  Resource: 'blocks.resource-card',
  Info: 'blocks.info-card',
  Navigation: 'blocks.navigation-card'
}

interface SecondaryCta {
  link?: string
  text?: string
  external?: boolean
  document?: boolean
}

export interface CardGridCard {
  __component?: string
  heading?: string
  subHeading?: string
  description?: string
  body?: string
  secondaryCta?: SecondaryCta
}

export interface CardGridSerializeInput {
  ariaLabel?: string
  variant?: string
  columns?: string
  /** @deprecated Prefer variant-specific fields; kept for tests and legacy. */
  cards?: CardGridCard[]
  titleCards?: CardGridCard[]
  resourceCards?: CardGridCard[]
  infoCards?: CardGridCard[]
  navigationCards?: CardGridCard[]
}

function isVariant(value: string | undefined): value is CardGridVariant {
  return (
    !!value && CARD_GRID_VARIANTS.includes(value as CardGridVariant)
  )
}

function isColumns(value: string | undefined): value is CardGridColumns {
  return !!value && CARD_GRID_COLUMNS.includes(value as CardGridColumns)
}

/** Resolve the active cards list for a variant (variant field first, then legacy `cards`). */
export function resolveCardGridCards(
  block: CardGridSerializeInput,
  variant: CardGridVariant
): CardGridCard[] {
  const field = VARIANT_CARDS_FIELD[variant]
  const fromField = block[field]
  if (Array.isArray(fromField) && fromField.length > 0) return fromField
  if (Array.isArray(block.cards) && block.cards.length > 0) return block.cards
  if (Array.isArray(fromField)) return fromField
  return block.cards ?? []
}

function validateSecondaryCta(
  cta: SecondaryCta | undefined,
  label: string,
  pathPrefix: (string | number)[]
): FieldError[] {
  const fieldErrors: FieldError[] = []
  if (!cta) {
    fieldErrors.push({
      message: `${label} is missing secondary call to action`,
      path: [...pathPrefix, 'secondaryCta']
    })
    return fieldErrors
  }
  if (!cta.link?.trim()) {
    fieldErrors.push({
      message: `${label} secondary CTA is missing link`,
      path: [...pathPrefix, 'secondaryCta', 'link']
    })
  }
  if (!cta.text?.trim()) {
    fieldErrors.push({
      message: `${label} secondary CTA is missing text`,
      path: [...pathPrefix, 'secondaryCta', 'text']
    })
  }
  if (cta.external && cta.document) {
    fieldErrors.push({
      message: `${label} secondary CTA cannot be both external and document`,
      path: [...pathPrefix, 'secondaryCta']
    })
  }
  return fieldErrors
}

function validateCard(
  card: CardGridCard,
  index: number,
  variant: CardGridVariant,
  fieldName: string
): FieldError[] {
  const position = index + 1
  const label = `${variant} card ${position}`
  const pathPrefix: (string | number)[] = [fieldName, index]
  const fieldErrors: FieldError[] = []
  const expected = VARIANT_COMPONENT[variant]

  if (card.__component && card.__component !== expected) {
    fieldErrors.push({
      message: `${label} must be ${expected} for variant ${variant} (got ${card.__component})`,
      path: [...pathPrefix, '__component']
    })
  }

  if (!card.heading?.trim()) {
    fieldErrors.push({
      message: `${label} is missing heading`,
      path: [...pathPrefix, 'heading']
    })
  }

  if (variant === 'Info') {
    if (!card.body?.trim()) {
      fieldErrors.push({
        message: `${label} is missing body`,
        path: [...pathPrefix, 'body']
      })
    }
  }

  if (variant === 'Title' || variant === 'Resource') {
    if (!card.description?.trim()) {
      fieldErrors.push({
        message: `${label} is missing description`,
        path: [...pathPrefix, 'description']
      })
    }
  }

  if (variant === 'Title' || variant === 'Resource' || variant === 'Navigation') {
    fieldErrors.push(
      ...validateSecondaryCta(card.secondaryCta, label, pathPrefix)
    )
  }

  return fieldErrors
}

const ALL_CARD_FIELDS = Object.values(VARIANT_CARDS_FIELD)

const FIELD_TO_VARIANT = Object.fromEntries(
  Object.entries(VARIANT_CARDS_FIELD).map(([variant, field]) => [
    field,
    variant
  ])
) as Record<(typeof ALL_CARD_FIELDS)[number], CardGridVariant>

function cardArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/**
 * Align card-grid repeatables before validate/save:
 * - If the selected variant's field has cards, clear the other three.
 * - If the selected field is empty but exactly one other field has cards
 *   (common when the admin UI showed all four sections), adopt that field's
 *   variant instead of wiping the only cards and failing validation.
 */
export function sanitizeCardGridBlock(
  block: Record<string, unknown>
): Record<string, unknown> {
  const populated = ALL_CARD_FIELDS.filter(
    (field) => cardArrayLength(block[field]) > 0
  )
  const rawVariant =
    typeof block.variant === 'string' ? block.variant : undefined
  const variant = isVariant(rawVariant) ? rawVariant : undefined

  if (variant && cardArrayLength(block[VARIANT_CARDS_FIELD[variant]]) > 0) {
    const active = VARIANT_CARDS_FIELD[variant]
    for (const field of ALL_CARD_FIELDS) {
      if (field !== active) block[field] = []
    }
    return block
  }

  // Active field empty (or variant missing) but cards exist elsewhere —
  // keep the first populated field and set variant to match. Never wipe the
  // only cards an editor added into a mismatched section.
  if (populated.length > 0) {
    const field = populated[0]!
    block.variant = FIELD_TO_VARIANT[field]
    for (const other of ALL_CARD_FIELDS) {
      if (other !== field) block[other] = []
    }
    return block
  }

  return block
}

/** Mutate dynamic-zone content in place, clearing inactive card-grid fields. */
export function sanitizeCardGridsInContent(content: unknown): void {
  if (!Array.isArray(content)) return
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      (block as { __component?: string }).__component === 'blocks.card-grid'
    ) {
      sanitizeCardGridBlock(block as Record<string, unknown>)
    }
  }
}

export function sanitizeCardGridsInDocumentData(
  data: Record<string, unknown> | undefined
): void {
  if (!data) return
  sanitizeCardGridsInContent(data.content)
  sanitizeCardGridsInContent(data.followUpContent)
}

export function validateCardGrid(block: CardGridSerializeInput): FieldError[] {
  const fieldErrors: FieldError[] = []

  if (!block.ariaLabel?.trim()) {
    fieldErrors.push({
      message: 'Card grid is missing accessibility label',
      path: ['ariaLabel']
    })
  }

  if (!isVariant(block.variant)) {
    fieldErrors.push({
      message: `Card grid variant must be one of ${CARD_GRID_VARIANTS.join(', ')}. Received "${block.variant}".`,
      path: ['variant']
    })
    return fieldErrors
  }

  const variant = block.variant
  // Only the active variant's cards are validated — inactive fields may be empty.
  const fieldName = VARIANT_CARDS_FIELD[variant]

  if (!isColumns(block.columns)) {
    fieldErrors.push({
      message: `Card grid columns must be one of ${CARD_GRID_COLUMNS.join(', ')}. Received "${block.columns}".`,
      path: ['columns']
    })
  } else if (block.columns === 'One' && variant !== 'Navigation') {
    fieldErrors.push({
      message: 'Only Navigation card grids may use a single column',
      path: ['columns']
    })
  }

  const cards = resolveCardGridCards(block, variant)

  if (cards.length === 0) {
    fieldErrors.push({
      message: 'Card grid requires at least one card',
      path: [fieldName]
    })
    return fieldErrors
  }

  if (variant === 'Resource' && cards.length < 2) {
    fieldErrors.push({
      message: 'Resource card grids require at least two cards',
      path: [fieldName]
    })
  }

  cards.forEach((card, index) => {
    fieldErrors.push(...validateCard(card, index, variant, fieldName))
  })

  return fieldErrors
}

function serializeCtaAttrs(cta: SecondaryCta): string {
  const external = cta.external ?? false
  const document = cta.document ?? false
  let attrs = ` buttonUrl="${esc(cta.link)}" buttonText="${esc(cta.text)}" buttonExternal={${external}}`
  if (document) attrs += ` buttonDocument={true}`
  return attrs
}

function serializeCard(card: CardGridCard, variant: CardGridVariant): string {
  const headingAttr = ` heading="${esc(card.heading)}"`

  if (variant === 'Info') {
    const body = escMdxBraces(card.body ?? '')
    return `<InfoCard${headingAttr}>\n\n${body}\n\n</InfoCard>`
  }

  if (variant === 'Navigation') {
    return `<NavigationCard${headingAttr}${serializeCtaAttrs(card.secondaryCta!)} />`
  }

  if (variant === 'Resource') {
    const description = escMdxBraces(card.description ?? '')
    return `<ResourceCard${headingAttr}${serializeCtaAttrs(card.secondaryCta!)}>\n\n${description}\n\n</ResourceCard>`
  }

  const subheadingAttr = card.subHeading
    ? ` subheading="${esc(card.subHeading)}"`
    : ''
  const description = escMdxBraces(card.description ?? '')
  return `<TitleCard${headingAttr}${subheadingAttr}${serializeCtaAttrs(card.secondaryCta!)}>\n${description}\n</TitleCard>`
}

export function serialize(block: CardGridSerializeInput): string {
  sanitizeCardGridBlock(block as Record<string, unknown>)
  const fieldErrors = validateCardGrid(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const variant = block.variant as CardGridVariant
  const cards = resolveCardGridCards(block, variant)
  const gridAttrs = ` ariaLabel="${esc(block.ariaLabel)}" variant="${esc(block.variant)}" columns="${esc(block.columns)}"`
  const cardMdx = cards.map((card) => serializeCard(card, variant))

  return `<CardGrid${gridAttrs}>\n${cardMdx.join('\n')}\n</CardGrid>`
}
