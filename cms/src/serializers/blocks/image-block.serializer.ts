import { getImageUrl, hasMediaValue } from '../../utils'
import { escDouble as esc } from '../shared'

type ImageField = { url?: string; alternativeText?: string } | number

interface LocalizedMediaField {
  image?: ImageField
  alternativeText?: string
}

interface ImageBlockBlock {
  media?: LocalizedMediaField
  tabletImage?: ImageField
  mobileImage?: ImageField
  needsFullView?: boolean
  needsOutline?: boolean
}

function asMediaObject(field: ImageField | undefined) {
  return typeof field === 'object' ? field : undefined
}

export function serialize(block: ImageBlockBlock): string {
  if (!block.media || !hasMediaValue(block.media.image))
    throw new Error('ImageBlock block is missing image')

  const image = asMediaObject(block.media.image)
  const src = getImageUrl(image)
  const alt = block.media.alternativeText ?? image?.alternativeText ?? ''
  const tabletSrc = getImageUrl(asMediaObject(block.tabletImage))
  const mobileSrc = getImageUrl(asMediaObject(block.mobileImage))

  const attrs: string[] = []
  if (src) attrs.push(`src="${esc(src)}"`)
  attrs.push(`alt="${esc(alt)}"`)
  if (tabletSrc) attrs.push(`tabletSrc="${esc(tabletSrc)}"`)
  if (mobileSrc) attrs.push(`mobileSrc="${esc(mobileSrc)}"`)
  if (block.needsFullView) attrs.push('needsFullView={true}')
  if (block.needsOutline) attrs.push('needsOutline={true}')

  return `<ImageBlock ${attrs.join(' ')} />`
}
