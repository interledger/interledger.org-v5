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
  
  if (block.alignment && block.alignment !== 'left') {
    return `<div class="text-${block.alignment}">\n\n${content}\n\n</div>`
  }
  return content
}
