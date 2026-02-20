import jsesc from 'jsesc'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  title: string
  description?: string
  ctaText?: string
  ctaUrl?: string
  backgroundColor?: string
}): string {
  const lines: string[] = []

  const attrs = [
    `title="${esc(block.title)}"`,
    block.ctaText ? `ctaText="${esc(block.ctaText)}"` : null,
    block.ctaUrl ? `ctaUrl="${esc(block.ctaUrl)}"` : null,
    block.backgroundColor
      ? `backgroundColor="${esc(block.backgroundColor)}"`
      : null
  ]
    .filter(Boolean)
    .join(' ')

  lines.push(`<CtaBanner ${attrs}>`)
  if (block.description) {
    lines.push(block.description)
  }
  lines.push('</CtaBanner>')
  return lines.join('\n')
}
