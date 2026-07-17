import { escDouble as esc } from '../shared'

export function serialize(block: {
  // On export the media relation is populated ({ url }); this serializer is also
  // reused for validation (validateContentBlocks) on the raw write body, where
  // `file` is a bare upload id. Both shapes must be accepted.
  file?: { url?: string } | number | null
  externalUrl?: string
  label?: string
}): string {
  const hasFile = block.file != null
  if (!hasFile && !block.externalUrl) {
    throw new Error('PdfEmbed block has neither file nor externalUrl')
  }

  // During validation `file` is a bare id (no url) and the output is discarded,
  // so an empty url is fine there; on export `file.url` is always populated.
  const fileUrl = typeof block.file === 'object' ? block.file?.url : undefined
  const url = fileUrl ?? block.externalUrl ?? ''

  const attrs: string[] = [`url="${esc(url)}"`]
  if (block.label) attrs.push(`label="${esc(block.label)}"`)

  return `<PdfEmbed ${attrs.join(' ')} />`
}
