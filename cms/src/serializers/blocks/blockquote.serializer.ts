import { formatBlockquote, ckeditorBreaksToNewlines } from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

export function serialize(block: { quote: string; source?: string }): string {
  if (!block.quote) throw new Error('Blockquote block is missing quote')
  // Escape { and } so MDX doesn't try to parse them as JS expressions
  const quote = escMdxBraces(formatBlockquote(block.quote))

  // source is a Strapi richtext (markdown) field — pass it directly so
  // Blockquote.astro can parse it as markdown via parseMarkdownInline.
  // marked (which parseMarkdownInline uses) escapes raw HTML tags, so a
  // CKEditor <br>/<br><br> line break is converted to \n/\n\n here instead
  // of staying literal.
  const sourceAttr = block.source
    ? ` source="${esc(ckeditorBreaksToNewlines(block.source))}"`
    : ''

  return `<Blockquote${sourceAttr}>\n  ${quote}\n</Blockquote>`
}
