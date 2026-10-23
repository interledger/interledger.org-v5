import {
  formatBlockquote,
  serializeIntroProp,
  type BlockIntroInput
} from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

export function serialize(block: {
  intro?: BlockIntroInput | null
  quote: string
  source?: string
}): string {
  if (!block.quote) throw new Error('Blockquote block is missing quote')
  // Escape { and } so MDX doesn't try to parse them as JS expressions
  const quote = escMdxBraces(formatBlockquote(block.quote))

  // source is a Strapi richtext (markdown) field — pass it directly so
  // Blockquote.astro can parse it as markdown via parseMarkdownInline
  const sourceAttr = block.source ? ` source="${esc(block.source)}"` : ''

  // Blank line is load-bearing: Prettier ignores proseWrap for JSX children
  // flush against tags, but respects it once they're a real paragraph (INTORG-1188).
  const introAttr = serializeIntroProp(block.intro)
  return `<Blockquote${introAttr}${sourceAttr}>\n\n${quote}\n\n</Blockquote>`
}
