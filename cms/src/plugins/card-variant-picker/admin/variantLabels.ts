export type CardVariant = 'Info' | 'Title' | 'Resource' | 'Navigation'

export const CARD_VARIANT_LABELS: Record<CardVariant, string> = {
  Info: 'Info',
  Title: 'Title',
  Resource: 'Resource',
  Navigation: 'Navigation'
}

const CARD_VARIANT_SLUGS = new Set<string>(Object.keys(CARD_VARIANT_LABELS))

export function isCardVariant(value: string): value is CardVariant {
  return CARD_VARIANT_SLUGS.has(value)
}
