import jsesc from 'jsesc'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

interface CtaButtonBlock {
  __component: 'blocks.cta-button'
  text: string
  link: string
  analytics_event_label?: string
}

export function serialize(block: CtaButtonBlock): string {
  if (!block.text || !block.link) return ''

  const attrs = [
    `text="${esc(block.text)}"`,
    `link="${esc(block.link)}"`,
    block.analytics_event_label
      ? `analytics_event_label="${esc(block.analytics_event_label)}"`
      : null
  ]
    .filter(Boolean)
    .join(' ')

  return `<CtaButton ${attrs} />`
}
