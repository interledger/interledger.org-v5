import {
  SerializerFieldError,
  normalizeTimelineSections,
  serializeIntroProp,
  type BlockIntroInput
} from '../../utils'

/**
 * Serialize blocks.timeline → MDX.
 *
 * Inverse of timelineHandler. Every field is plain text with a fixed shape, so
 * the sections arrive as one static array prop rather than as child elements —
 * the same shape as NumberTiles and DonationCards. The optional block intro
 * goes first, as on every other block that has one.
 */
export function serialize(block: {
  intro?: BlockIntroInput | null
  sections?: unknown
}): string {
  const sections = normalizeTimelineSections(block.sections)
  if (sections instanceof Error) {
    throw new SerializerFieldError(sections.fieldErrors)
  }

  const introAttr = serializeIntroProp(block.intro)
  return `<Timeline${introAttr} sections={${JSON.stringify(sections)}} />`
}
