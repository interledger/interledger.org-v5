import { escDouble as esc } from '../shared'

export function serialize(block: {
  file?: { url: string }
  externalUrl?: string
  label?: string
  analyticsEvent: string
}): string {
  const url = block.file?.url ?? block.externalUrl
  if (!url) throw new Error('PdfEmbed block has neither file nor externalUrl')

  const attrs: string[] = [
    `url="${esc(url)}"`,
    `analyticsEvent="${esc(block.analyticsEvent)}"`
  ]
  if (block.label) attrs.push(`label="${esc(block.label)}"`)

  return `<PdfEmbed ${attrs.join(' ')} />`
}
