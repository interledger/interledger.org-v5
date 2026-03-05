import isHtml from 'is-html'
import { htmlToMarkdown } from '../../utils/mdx'

export function serialize(block: {
  content: string
  alignment?: string
}): string {
  // If content is already markdown (not HTML), use it directly
  // Otherwise convert HTML to markdown
  const content = isHtml(block.content)
    ? htmlToMarkdown(block.content)
    : block.content

  const alignmentAttr =
    block.alignment && block.alignment !== 'left'
      ? ` alignment="${block.alignment}"`
      : ''
  return `<Paragraph${alignmentAttr}>\n\n${content}\n\n</Paragraph>`
}
