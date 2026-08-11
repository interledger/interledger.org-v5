import {
  CARD_GRID_VARIANT_LABELS,
  type CardGridVariant
} from '../../../utils/cardGrid'

export type CardVariant = CardGridVariant

export const CARD_VARIANT_LABELS = CARD_GRID_VARIANT_LABELS

const CARD_VARIANT_SLUGS = new Set<string>(Object.keys(CARD_VARIANT_LABELS))

export function isCardVariant(value: string): value is CardVariant {
  return CARD_VARIANT_SLUGS.has(value)
}
