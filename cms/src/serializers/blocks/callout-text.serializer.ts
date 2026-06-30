import isHtml from 'is-html'
import { htmlToMarkdown } from '../../utils'

export function serialize(block: { content: string }): string {
  if (!block.content) throw new Error('Callout Text block is missing content')

  const content = (
    isHtml(block.content) ? htmlToMarkdown(block.content) : block.content
  )
    .trim()
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')

  return `<CalloutText>\n${content}\n</CalloutText>`
}
