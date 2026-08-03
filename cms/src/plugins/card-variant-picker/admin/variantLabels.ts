export type CardVariant = 'Resource' | 'Info' | 'Navigation' | 'Title'

export const CARD_VARIANT_LABELS: Record<CardVariant, string> = {
  Resource: 'Resource',
  Info: 'Info',
  Navigation: 'Navigation',
  Title: 'Title'
}

const CARD_VARIANT_SLUGS = new Set<string>(Object.keys(CARD_VARIANT_LABELS))

export function isCardVariant(value: string): value is CardVariant {
  return CARD_VARIANT_SLUGS.has(value)
}
