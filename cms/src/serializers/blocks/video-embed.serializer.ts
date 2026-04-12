import { escDouble as esc } from '../shared'

export function serialize(block: { url: string; title: string }): string {
  if (!block.url) throw new Error('VideoEmbed block is missing url')
  if (!block.title) throw new Error('VideoEmbed block is missing title')

  return `<VideoEmbed url="${esc(block.url)}" title="${esc(block.title)}" />`
}
