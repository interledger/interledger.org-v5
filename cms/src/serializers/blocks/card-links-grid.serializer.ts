import jsesc from 'jsesc'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  heading?: string
  links?: Array<{
    title: string
    description?: string
    url: string
    icon?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }

  lines.push('<CardLinksGrid>')

  if (block.links) {
    for (const link of block.links) {
      lines.push('')
      lines.push(`<CardLink title="${esc(link.title)}" url="${esc(link.url)}"${link.icon ? ` icon="${esc(link.icon)}"` : ''}>`)
      if (link.description) {
        lines.push(link.description)
      }
      lines.push('</CardLink>')
    }
  }

  lines.push('')
  lines.push('</CardLinksGrid>')
  return lines.join('\n')
}
