import { escDouble as esc } from '../shared'

export function serialize(block: {
  heading?: string
  accessibilityLabel?: string
  logos?: {
    id: number
    url: string
    alternativeText: string | null
  }[]
}): string {
  // Strapi's `required: true` on `logos`/`accessibilityLabel` isn't enforced at save time
  if (!block.logos || block.logos.length === 0) {
    throw new Error('Carousel block is missing logos')
  }
  if (!block.accessibilityLabel) {
    throw new Error('Carousel block is missing accessibilityLabel')
  }

  const logoItems = block.logos.map((logo) => ({
    // '' (not null) so the rendered <img> gets alt=""
    name: logo.alternativeText ?? '',
    src: logo.url
  }))

  const headingAttr = block.heading ? ` heading="${esc(block.heading)}"` : ''
  const labelAttr = ` accessibilityLabel="${esc(block.accessibilityLabel)}"`
  const logosAttr = ` logos={${JSON.stringify(logoItems)}}`

  return `<LogoCarousel${headingAttr}${labelAttr}${logosAttr} />`
}
