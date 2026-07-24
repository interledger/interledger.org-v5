import { escDouble as esc } from '../shared'

const CTA_LINK_STYLES = ['primary', 'secondary'] as const
type CtaLinkStyle = (typeof CTA_LINK_STYLES)[number]

function isCtaLinkStyle(value: string): value is CtaLinkStyle {
  return CTA_LINK_STYLES.includes(value as CtaLinkStyle)
}

export function serialize(block: {
  text: string
  link: string
  style?: string
  external?: boolean
}): string {
  if (!block.text) throw new Error('CtaLink block is missing text')
  if (!block.link) throw new Error('CtaLink block is missing link')

  const attrs = [`text="${esc(block.text)}"`, `link="${esc(block.link)}"`]

  if (block.style && block.style !== 'primary') {
    if (!isCtaLinkStyle(block.style)) {
      throw new Error(
        `CtaLink "style" must be one of ${CTA_LINK_STYLES.join(', ')}. Received "${block.style}".`
      )
    }
    attrs.push(`style="${esc(block.style)}"`)
  }
  if (block.external) {
    attrs.push('external={true}')
  }

  return `<CtaLink ${attrs.join(' ')} />`
}
