import { normalizeUploadsUrls } from '../../utils/mdx'

export function serialize(block: {
  content: string
  alignment?: string
}): string {
  const alignmentAttr =
    block.alignment && block.alignment !== 'left'
      ? ` alignment="${block.alignment}"`
      : ''
  const content = normalizeUploadsUrls(block.content)
  return `<Paragraph${alignmentAttr}>\n\n${content}\n\n</Paragraph>`
}
