import { escDouble as esc } from '../shared'

export function serialize(block: {
  // On export the media relation is populated ({ url }); this serializer is also
  // reused for validation (validateContentBlocks) on the raw write body, where
  // `file` is a bare upload id. Both shapes must be accepted.
  file?: { url?: string } | number | null
  externalUrl?: string
  title: string
}): string {
  if (!block.title) throw new Error('VideoEmbed block is missing title')

  const hasFile = block.file != null
  if (!hasFile && !block.externalUrl) {
    throw new Error('VideoEmbed block has neither file nor externalUrl')
  }

  // During validation `file` is a bare id (no url) and the output is discarded,
  // so an empty url is fine there; on export `file.url` is always populated.
  const fileUrl = typeof block.file === 'object' ? block.file?.url : undefined
  const url = fileUrl ?? block.externalUrl ?? ''

  return `<VideoEmbed url="${esc(url)}" title="${esc(block.title)}" />`
}
