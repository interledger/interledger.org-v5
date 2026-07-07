import { formatBlockquote } from '../../utils'
import { escDouble as esc } from '../shared'

export function serialize(block: { quote: string; source?: string }): string {
  if (!block.quote) throw new Error('Blockquote block is missing quote')
  // Escape { and } so MDX doesn't try to parse them as JS expressions
  const quote = formatBlockquote(block.quote)
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')

  // source is a Strapi richtext (markdown) field — pass it directly so
  // Blockquote.astro can parse it as markdown via parseMarkdownInline
  const sourceAttr = block.source ? ` source="${esc(block.source)}"` : ''

  return `<Blockquote${sourceAttr}>\n  ${quote}\n</Blockquote>`
}
