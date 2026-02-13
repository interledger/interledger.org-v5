import jsesc from 'jsesc'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  heading?: string
  subheading?: string
  columns?: string
  cards?: Array<{
    title: string
    description?: string
    link?: string
    linkText?: string
    icon?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }
  if (block.subheading) {
    lines.push(block.subheading)
    lines.push('')
  }

  lines.push(`<CardsGrid columns={${block.columns || 3}}>`)

  if (block.cards) {
    for (const card of block.cards) {
      lines.push('')
      lines.push(`<Card title="${esc(card.title)}"${card.link ? ` link="${esc(card.link)}"` : ''}${card.linkText ? ` linkText="${esc(card.linkText)}"` : ''}${card.icon ? ` icon="${esc(card.icon)}"` : ''}>`)
      if (card.description) {
        lines.push(card.description)
      }
      lines.push('</Card>')
    }
  }

  lines.push('')
  lines.push('</CardsGrid>')
  return lines.join('\n')
}
