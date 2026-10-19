import { SerializerFieldError, normalizeTimelineSections } from '../../utils'

/**
 * Serialize blocks.timeline → MDX.
 *
 * Inverse of timelineHandler. Every field is plain text with a fixed shape, so
 * the sections arrive as one static array prop rather than as child elements —
 * the same shape as NumberTiles and DonationCards. Block-level heading,
 * subheading and description are deliberately absent: they arrive with the
 * shared block intro once INTORG-1154 lands (INTORG-1348).
 */
export function serialize(block: { sections?: unknown }): string {
  const sections = normalizeTimelineSections(block.sections)
  if (sections instanceof Error) {
    throw new SerializerFieldError(sections.fieldErrors)
  }

  return `<Timeline sections={${JSON.stringify(sections)}} />`
}
