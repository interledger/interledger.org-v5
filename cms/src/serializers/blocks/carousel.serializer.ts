import { escDouble as esc } from '../shared'

export function serialize(block: {
  heading?: string
  accessibilityLabel?: string
  logos?: {
    id: number
    url: string
    alternativeText: string
  }[]
}): string {
  const logoItems = (block.logos ?? []).map((logo) => ({
    name: logo.alternativeText,
    src: logo.url
  }))

  const headingAttr = block.heading ? ` heading="${esc(block.heading)}"` : ''
  const labelAttr = block.accessibilityLabel
    ? ` carouselLabel="${esc(block.accessibilityLabel)}"`
    : ''
  const logosAttr = logoItems.length
    ? ` logos={${JSON.stringify(logoItems)}}`
    : ''

  return `<LogoCarousel${headingAttr}${labelAttr}${logosAttr} />`
}
