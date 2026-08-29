export const CARD_GRID_COLUMNS = ['One', 'Two', 'Three'] as const
export type CardGridColumns = (typeof CARD_GRID_COLUMNS)[number]

export const CARD_GRID_VARIANT_DEFINITIONS = [
  {
    value: 'Info',
    label: 'Info',
    cardsField: 'infoCards',
    fieldLabel: 'Info cards',
    strapiComponent: 'blocks.info-card',
    mdxChild: 'InfoCard'
  },
  {
    value: 'Title',
    label: 'Title',
    cardsField: 'titleCards',
    fieldLabel: 'Title cards',
    strapiComponent: 'blocks.title-card',
    mdxChild: 'TitleCard'
  },
  {
    value: 'Resource',
    label: 'Resource',
    cardsField: 'resourceCards',
    fieldLabel: 'Resource cards',
    strapiComponent: 'blocks.resource-card',
    mdxChild: 'ResourceCard'
  },
  {
    value: 'Navigation',
    label: 'Navigation',
    cardsField: 'navigationCards',
    fieldLabel: 'Navigation cards',
    strapiComponent: 'blocks.navigation-card',
    mdxChild: 'NavigationCard'
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
  secondSecondaryCta?: CardGridSecondaryCta
  /** InfoCard cover image: site-relative path used in MDX (`imageSrc`). */
  imageSrc?: string
  /** InfoCard cover image: Strapi media id or populated `{ url }`. */
  image?: unknown
  imageAlt?: string | null
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

/**
 * Content-type restrictions for which Card Grid variants editors may pick.
 * Unlisted UIDs get every variant (foundation, summit, hackathon, etc.).
 *
 * Same `blocks.card-grid` component in every dynamic zone — restrictions are
 * enforced in the admin picker + document validation + MDX sync, not by
 * forking the component schema.
 */
export const CARD_GRID_ALLOWED_VARIANTS_BY_UID: Partial<
  Record<string, readonly CardGridVariant[]>
> = {
  'api::grant-page.grant-page': ['Info'],
  'api::grant-overview-page.grant-overview-page': ['Title']
}

/**
 * Variants allowed for a content type. Unknown/unlisted UIDs get every
 * variant. `null`/`undefined` also returns every variant for server/MDX
 * paths with no document context — admin UI must fail closed instead
 * (see CardVariantPicker) so restricted types never unlock by accident.
 */
export function getAllowedCardGridVariants(
  contentTypeUid: string | null | undefined
): readonly CardGridVariant[] {
  if (!contentTypeUid) return CARD_GRID_VARIANTS
  return CARD_GRID_ALLOWED_VARIANTS_BY_UID[contentTypeUid] ?? CARD_GRID_VARIANTS
}

export function formatCardGridVariantList(
  variants: readonly CardGridVariant[]
): string {
  if (variants.length === 0) return ''
  if (variants.length === 1) return variants[0]!
  if (variants.length === 2) return `${variants[0]} or ${variants[1]}`
  return `${variants.slice(0, -1).join(', ')}, or ${variants.at(-1)}`
}

export function isCardGridVariantAllowed(
  variant: string,
  contentTypeUid: string | null | undefined
): variant is CardGridVariant {
  if (!(CARD_GRID_VARIANTS as readonly string[]).includes(variant)) return false
  return getAllowedCardGridVariants(contentTypeUid).includes(
    variant as CardGridVariant
  )
}
