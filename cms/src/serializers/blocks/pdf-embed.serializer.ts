export function serialize(block: {
  file?: { url: string }
  externalUrl?: string
  label?: string
  analyticsEvent: string
}): string {
  const url = block.file?.url ?? block.externalUrl
  if (!url) throw new Error('PdfEmbed block has neither file nor externalUrl')

  const attrs: string[] = [`url="${url}"`, `analyticsEvent="${block.analyticsEvent}"`]
  if (block.label) attrs.push(`label="${block.label}"`)

  return `<PdfEmbed ${attrs.join(' ')} />`
}
