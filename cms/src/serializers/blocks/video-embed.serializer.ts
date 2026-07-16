import { escDouble as esc } from '../shared'

export function serialize(block: {
  file?: { url: string }
  externalUrl?: string
  title: string
}): string {
  const url = block.file?.url ?? block.externalUrl
  if (!url) throw new Error('VideoEmbed block has neither file nor externalUrl')
  if (!block.title) throw new Error('VideoEmbed block is missing title')

  return `<VideoEmbed url="${esc(url)}" title="${esc(block.title)}" />`
}
