import { ckeditorFieldToCompiledMarkdown } from '../../utils'
import { escMdxBraces } from '../shared'

export function serialize(block: { content: string }): string {
  if (!block.content) throw new Error('Callout Text block is missing content')

  const content = escMdxBraces(ckeditorFieldToCompiledMarkdown(block.content))

  // Blank line is load-bearing: Prettier ignores proseWrap for JSX children
  // flush against tags, but respects it once they're a real paragraph (INTORG-1188).
  return `<CalloutText>\n\n${content}\n\n</CalloutText>`
}
