import isHtml from 'is-html'
import { htmlToMarkdown } from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

export function serialize(block: {
  heading?: string
  description?: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color?: string
}): string {
  if (!block.primaryButtonText)
    throw new Error('CTA Strip block is missing primary button text')
  if (!block.primaryButtonLink)
    throw new Error('CTA Strip block is missing primary button link')

  const attrs = [
    block.heading ? `heading="${esc(block.heading)}"` : null,
    `primaryButtonText="${esc(block.primaryButtonText)}"`,
    `primaryButtonLink="${esc(block.primaryButtonLink)}"`
  ]
    .filter(Boolean)
    .join(' ')

  // description is a Strapi text (markdown) field — render it as the children
  // and brace-escape so MDX doesn't parse { } as JS expressions.
  const description = block.description
    ? escMdxBraces(
        isHtml(block.description)
          ? htmlToMarkdown(block.description)
          : block.description
      )
    : ''

  return description
    ? `<CtaStrip ${attrs}>\n${description}\n</CtaStrip>`
    : `<CtaStrip ${attrs} />`
}
