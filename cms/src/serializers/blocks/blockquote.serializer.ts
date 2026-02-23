import jsesc from 'jsesc'
import { formatBlockquote, htmlToMarkdown } from '../../utils/mdx'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  quote: string
  source?: string
}): string {
  // Escape { and } so MDX doesn't try to parse them as JS expressions
  const quote = formatBlockquote(block.quote)
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')

  const sourceAttr = block.source
    ? ` source="${esc(htmlToMarkdown(block.source))}"`
    : ''

  return `<Blockquote${sourceAttr}>\n  ${quote}\n</Blockquote>`
}
