import { serializeIntroProp, type BlockIntroInput } from '../../utils'
import { escDouble as esc } from '../shared'

export function serialize(block: {
  /** Optional block intro (ADR-009). */
  intro?: BlockIntroInput | null
  // On export the media relation is populated ({ url }); this serializer is also
  // reused for validation (validateContentBlocks) on the raw write body, where
  // `file` is a bare upload id. Both shapes must be accepted.
  file?: { url?: string } | number | null
  externalUrl?: string
  title: string
  poster?: { url?: string } | number | null
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
  const posterUrl =
    typeof block.poster === 'object' ? block.poster?.url : undefined

  const introAttr = serializeIntroProp(block.intro).trim()
  const attrs = [
    ...(introAttr ? [introAttr] : []),
    `url="${esc(url)}"`,
    // The play label, not the intro heading.
    `title="${esc(block.title)}"`
  ]
  if (posterUrl) attrs.push(`poster="${esc(posterUrl)}"`)

  return `<VideoEmbed ${attrs.join(' ')} />`
}
