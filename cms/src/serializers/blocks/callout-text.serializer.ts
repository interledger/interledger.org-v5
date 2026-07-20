import isHtml from 'is-html'
import { htmlToMarkdown } from '../../utils'
import { escMdxBraces } from '../shared'

export function serialize(block: { content: string }): string {
  if (!block.content) throw new Error('Callout Text block is missing content')

  const content = escMdxBraces(
    isHtml(block.content) ? htmlToMarkdown(block.content) : block.content
  )

  return `<CalloutText>\n${content}\n</CalloutText>`
}
