import isHtml from 'is-html'
import { htmlToMarkdown } from '../../utils'
import { escDouble as esc } from '../shared'

export function serialize(block: {
  heading: string
  description: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color?: string
}): string {
  const attrs = [
    `heading="${esc(block.heading)}"`,
    `primaryButtonText="${esc(block.primaryButtonText)}"`,
    `primaryButtonLink="${esc(block.primaryButtonLink)}"`,
    block.secondaryButtonText
      ? `secondaryButtonText="${esc(block.secondaryButtonText)}"`
      : null,
    block.secondaryButtonLink
      ? `secondaryButtonLink="${esc(block.secondaryButtonLink)}"`
      : null,
    block.color ? `color="${esc(block.color)}"` : null
  ]
    .filter(Boolean)
    .join(' ')

  // description is a Strapi text (markdown) field — render it as the children
  // and brace-escape so MDX doesn't parse { } as JS expressions.
  const description = (
    isHtml(block.description)
      ? htmlToMarkdown(block.description)
      : block.description
  )
    .trim()
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')

  return `<CtaStrip ${attrs}>\n${description}\n</CtaStrip>`
}
