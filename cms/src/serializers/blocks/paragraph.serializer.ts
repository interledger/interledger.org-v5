export function serialize(block: {
  content: string
  alignment?: string
}): string {
  const alignmentAttr =
    block.alignment && block.alignment !== 'left'
      ? ` alignment="${block.alignment}"`
      : ''
  if (!block.content) throw new Error('Paragraph block is missing content')
  return `<Paragraph${alignmentAttr}>\n\n${block.content}\n\n</Paragraph>`
}
