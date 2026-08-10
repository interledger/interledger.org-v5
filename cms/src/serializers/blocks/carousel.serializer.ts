import { getImageUrl, hasMediaValue } from '../../utils'
import { escDouble as esc } from '../shared'

type MediaField =
  | { url?: string; alternativeText?: string | null }
  | number
  | string
  | null
  | undefined

/** One interface so legacy `url` and component `image` shapes coexist without a broken union narrow. */
interface CarouselLogoEntry {
  image?: MediaField
  alternativeText?: string | null
  /** Legacy shape: plain multi-media entries (pre carousel-logo component) */
  id?: number
  url?: string
}

function logoHasImage(logo: CarouselLogoEntry): boolean {
  if (typeof logo.url === 'string' && logo.url.length > 0) {
    return true
  }
  return hasMediaValue(logo.image as Parameters<typeof hasMediaValue>[0])
}

function logoToMdxItem(logo: CarouselLogoEntry): { name: string; src: string } {
  // Legacy multi-media entry
  if (typeof logo.url === 'string' && logo.url.length > 0) {
    return {
      name: logo.alternativeText ?? '',
      src: logo.url
    }
  }

  const image = logo.image
  // On export the relation is populated ({ url }); validateContentBlocks also
  // runs this serializer on the raw write body where `image` is a bare upload
  // id — empty src is fine there because the output is discarded.
  const src =
    typeof image === 'object' && image != null ? (getImageUrl(image) ?? '') : ''
  const fileAlt =
    typeof image === 'object' && image != null
      ? (image.alternativeText ?? '')
      : ''
  // Prefer field-level alt on carousel-logo. Explicit null means empty alt
  // (do not fall through to Media Library alt). Only use file alt when the
  // component field is absent (legacy / unmigrated rows).
  const name =
    logo.alternativeText !== undefined ? (logo.alternativeText ?? '') : fileAlt
  return { name, src }
}

export function serialize(block: {
  heading?: string
  accessibilityLabel?: string
  logos?: CarouselLogoEntry[]
}): string {
  // Strapi's `required: true` on `logos`/`accessibilityLabel` isn't enforced at save time
  if (!block.logos || block.logos.length === 0) {
    throw new Error('Carousel block is missing logos')
  }
  if (!block.accessibilityLabel) {
    throw new Error('Carousel block is missing accessibilityLabel')
  }

  for (const logo of block.logos) {
    if (!logoHasImage(logo)) {
      throw new Error('Carousel logo is missing image')
    }
  }

  const logoItems = block.logos.map(logoToMdxItem)

  const headingAttr = block.heading ? ` heading="${esc(block.heading)}"` : ''
  const labelAttr = ` accessibilityLabel="${esc(block.accessibilityLabel)}"`
  const logosAttr = ` logos={${JSON.stringify(logoItems)}}`

  return `<LogoCarousel${headingAttr}${labelAttr}${logosAttr} />`
}
