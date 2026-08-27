import { ckeditorFieldToCompiledMarkdown } from '../../utils'
import { escMdxBraces } from '../shared'

export function serialize(block: { content: string }): string {
  if (!block.content) throw new Error('Callout Text block is missing content')

  const content = escMdxBraces(ckeditorFieldToCompiledMarkdown(block.content))

  return `<CalloutText>\n${content}\n</CalloutText>`
}
