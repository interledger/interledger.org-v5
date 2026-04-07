import isHtml from 'is-html'
import { htmlToMarkdown, normalizeUploadsUrls } from '../../utils/mdx'

export function serialize(block: { content: string }): string {
  if (!block.content) return ''

  const content = normalizeUploadsUrls(
    (isHtml(block.content) ? htmlToMarkdown(block.content) : block.content)
      .trim()
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
  )

  return `<CalloutText>\n${content}\n</CalloutText>`
}
