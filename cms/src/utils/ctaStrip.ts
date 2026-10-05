/**
 * CTA Strip colour. Purple is the default. Green is the pistachio variant.
 *
 * Page-owned strips (grant, grant overview, podcast) are updated in place, so
 * the import always sends a colour. Omitting it would leave a previously
 * synced green in Strapi after the MDX stopped asking for one.
 */

export const CTA_STRIP_COLORS = ['purple', 'green'] as const
export type CtaStripColor = (typeof CTA_STRIP_COLORS)[number]

export function isCtaStripColor(value: unknown): value is CtaStripColor {
  return CTA_STRIP_COLORS.includes(value as CtaStripColor)
}

/** Absent, purple, or anything else resolves to the default. */
export function ctaStripColorPayload(color: unknown): CtaStripColor {
  return color === 'green' ? 'green' : 'purple'
}

/** MDX frontmatter: purple stays omitted; green is written so sync round-trips. */
export function ctaStripColorMdxFields(
  color: unknown
): { color: 'green' } | Record<string, never> {
  return color === 'green' ? { color: 'green' } : {}
}
