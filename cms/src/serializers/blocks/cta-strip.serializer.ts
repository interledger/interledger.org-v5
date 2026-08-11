import { ckeditorFieldToMarkdown } from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

/**
 * Serialize blocks.cta-strip → MDX.
 *
 * Strips are always purple, so there is no colour attribute. The secondary CTA
 * is optional and its two fields travel together: a half-filled one would
 * render as a dead or unlabelled button, so it is only emitted when both are
 * set.
 */
export function serialize(block: {
  heading?: string
  description?: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
}): string {
  if (!block.primaryButtonText)
    throw new Error('CTA Strip block is missing primary button text')
  if (!block.primaryButtonLink)
    throw new Error('CTA Strip block is missing primary button link')

  const hasSecondary = Boolean(
    block.secondaryButtonText?.trim() && block.secondaryButtonLink?.trim()
  )

  const attrs = [
    block.heading ? `heading="${esc(block.heading)}"` : null,
    `primaryButtonText="${esc(block.primaryButtonText)}"`,
    `primaryButtonLink="${esc(block.primaryButtonLink)}"`,
    hasSecondary
      ? `secondaryButtonText="${esc(block.secondaryButtonText!.trim())}"`
      : null,
    hasSecondary
      ? `secondaryButtonLink="${esc(block.secondaryButtonLink!.trim())}"`
      : null
  ]
    .filter(Boolean)
    .join(' ')

  // description is a Strapi text (markdown) field — render it as the children
  // and brace-escape so MDX doesn't parse { } as JS expressions.
  const description = block.description
    ? escMdxBraces(ckeditorFieldToMarkdown(block.description))
    : ''

  return description
    ? `<CtaStrip ${attrs}>\n${description}\n</CtaStrip>`
    : `<CtaStrip ${attrs} />`
}
