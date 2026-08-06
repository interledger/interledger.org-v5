import { escDouble as esc } from '../shared'

type PopulatedLogo =
  | {
      image?: { url?: string; alternativeText?: string | null } | null
      alternativeText?: string | null
    }
  // Legacy shape: plain multi-media entries (pre–carousel-logo component)
  | { id: number; url: string; alternativeText: string | null }

function logoToMdxItem(logo: PopulatedLogo): { name: string; src: string } {
  if ('url' in logo && typeof logo.url === 'string') {
    return {
      name: logo.alternativeText ?? '',
      src: logo.url
    }
  }
  const src = logo.image?.url
  if (!src) {
    throw new Error('Carousel logo is missing image url')
  }
  // Prefer field-level alt on carousel-logo; fall back to file alt for old data
  const name = logo.alternativeText ?? logo.image?.alternativeText ?? ''
  return { name, src }
}

export function serialize(block: {
  heading?: string
  accessibilityLabel?: string
  logos?: PopulatedLogo[]
}): string {
  // Strapi's `required: true` on `logos`/`accessibilityLabel` isn't enforced at save time
  if (!block.logos || block.logos.length === 0) {
    throw new Error('Carousel block is missing logos')
  }
  if (!block.accessibilityLabel) {
    throw new Error('Carousel block is missing accessibilityLabel')
  }

  const logoItems = block.logos.map(logoToMdxItem)

  const headingAttr = block.heading ? ` heading="${esc(block.heading)}"` : ''
  const labelAttr = ` accessibilityLabel="${esc(block.accessibilityLabel)}"`
  const logosAttr = ` logos={${JSON.stringify(logoItems)}}`

  return `<LogoCarousel${headingAttr}${labelAttr}${logosAttr} />`
}
