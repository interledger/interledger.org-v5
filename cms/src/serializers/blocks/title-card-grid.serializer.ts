import { escDouble as esc, escMdxBraces } from '../shared'

export function serialize(block: {
  columns?: 'Three' | 'Two'
  ariaLabel?: string
  titleCards?: {
    heading?: string
    subHeading?: string
    description?: string
    secondaryCta?: {
      link?: string
      text?: string
      external?: boolean
    }
  }[]
}): string {
  if (!block.columns)
    throw new Error('Title card grid: Columns must have a value')
  if (!block.ariaLabel)
    throw new Error('Title card grid: Accessibility label is missing')
  if (!Array.isArray(block.titleCards) || block.titleCards.length === 0)
    throw new Error('Title card grid: Card is missing')

  const gridAttrs = ` ariaLabel="${esc(block.ariaLabel)}" columns="${esc(block.columns)}"`

  const cards = block.titleCards.map((card) => {
    if (!card.heading) throw new Error('Title card: Card heading is missing')
    if (!card.description)
      throw new Error('Title card: Card description is missing')
    if (!card.secondaryCta)
      throw new Error('Title card: Call to action button is missing')

    const headingAttr = ` heading="${esc(card.heading)}"`
    const subheadingAttr = card.subHeading
      ? ` subheading="${esc(card.subHeading)}"`
      : ''
    const ctaAttrs = ` buttonUrl="${esc(card.secondaryCta.link)}" buttonText="${esc(card.secondaryCta.text)}" buttonExternal={${card.secondaryCta.external ?? false}}`

    const description = escMdxBraces(card.description)

    return `<TitleCard${headingAttr}${subheadingAttr}${ctaAttrs}>\n${description}\n  </TitleCard>`
  })

  return `<TitleCardGrid${gridAttrs}>\n  ${cards.join('\n  ')}\n</TitleCardGrid>`
}
