import { htmlToMarkdown } from '../../utils/mdx'

export function serialize(block: {
  content: string
  alignment?: string
}): string {
  const content = htmlToMarkdown(block.content)
  if (block.alignment && block.alignment !== 'left') {
    return `<div class="text-${block.alignment}">\n\n${content}\n\n</div>`
  }
  return content
}
