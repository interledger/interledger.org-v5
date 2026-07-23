import { escDouble as esc } from '../shared'

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
    attrs.push(`style="${esc(block.style)}"`)
  }
  if (block.external) {
    attrs.push('external={true}')
  }

  return `<CtaLink ${attrs.join(' ')} />`
}
