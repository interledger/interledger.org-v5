export const CARD_GRID_COLUMNS = ['One', 'Two', 'Three'] as const
export type CardGridColumns = (typeof CARD_GRID_COLUMNS)[number]

export const CARD_GRID_VARIANT_DEFINITIONS = [
  {
    value: 'Info',
    label: 'Info',
    cardsField: 'infoCards',
    fieldLabel: 'Info cards',
    strapiComponent: 'blocks.info-card',
    mdxChild: 'InfoCard',
    helpText: 'Add Info cards for this grid.'
  },
  {
    value: 'Title',
    label: 'Title',
    cardsField: 'titleCards',
    fieldLabel: 'Title cards',
    strapiComponent: 'blocks.title-card',
    mdxChild: 'TitleCard',
    helpText: 'Add Title cards for this grid.'
  },
  {
    value: 'Resource',
    label: 'Resource',
    cardsField: 'resourceCards',
    fieldLabel: 'Resource cards',
    strapiComponent: 'blocks.resource-card',
    mdxChild: 'ResourceCard',
    helpText: 'Add Resource cards for this grid. At least two required.'
  },
  {
    value: 'Navigation',
    label: 'Navigation',
    cardsField: 'navigationCards',
    fieldLabel: 'Navigation cards',
    strapiComponent: 'blocks.navigation-card',
    mdxChild: 'NavigationCard',
    helpText: 'Add Navigation cards for this grid.'
  }
] as const

export type CardGridVariant =
  (typeof CARD_GRID_VARIANT_DEFINITIONS)[number]['value']
export type CardGridCardsField =
  (typeof CARD_GRID_VARIANT_DEFINITIONS)[number]['cardsField']

export interface CardGridSecondaryCta {
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
  secondaryCta?: CardGridSecondaryCta
}

export const CARD_GRID_VARIANTS = CARD_GRID_VARIANT_DEFINITIONS.map(
  (variant) => variant.value
)

export const CARD_GRID_VARIANT_LABELS = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [variant.value, variant.label])
) as Record<CardGridVariant, string>

export const CARD_GRID_VARIANT_FIELDS = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [
    variant.value,
    variant.cardsField
  ])
) as Record<CardGridVariant, CardGridCardsField>

export const CARD_GRID_FIELD_LABELS = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [
    variant.cardsField,
    variant.fieldLabel
  ])
) as Record<CardGridCardsField, string>

export const CARD_GRID_VARIANT_COMPONENTS = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [
    variant.value,
    variant.strapiComponent
  ])
) as Record<CardGridVariant, string>

export const CARD_GRID_VARIANT_CHILDREN = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [
    variant.value,
    variant.mdxChild
  ])
) as Record<CardGridVariant, string>

export const CARD_GRID_VARIANT_LIST_LABEL = `${CARD_GRID_VARIANTS.slice(0, -1).join(', ')}, or ${CARD_GRID_VARIANTS.at(-1)}`
