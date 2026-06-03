import { getImageUrl } from '../../utils'
import { escDouble as esc } from '../shared'

interface ImageBlockBlock {
  image?: { url?: string; alternativeText?: string }
  tabletImage?: { url?: string; alternativeText?: string }
  mobileImage?: { url?: string; alternativeText?: string }
  altText?: string
  needsFullView?: boolean
  needsOutline?: boolean
}

export function serialize(block: ImageBlockBlock): string {
  const src = getImageUrl(block.image)
  if (!src) throw new Error('ImageBlock block is missing image')

  const alt = block.altText ?? block.image?.alternativeText ?? ''
  const tabletSrc = getImageUrl(block.tabletImage)
  const mobileSrc = getImageUrl(block.mobileImage)

  const attrs: string[] = [`src="${esc(src)}"`, `alt="${esc(alt)}"`]
  if (tabletSrc) attrs.push(`tabletSrc="${esc(tabletSrc)}"`)
  if (mobileSrc) attrs.push(`mobileSrc="${esc(mobileSrc)}"`)
  if (block.needsFullView) attrs.push('needsFullView={true}')
  if (block.needsOutline) attrs.push('needsOutline={true}')

  return `<ImageBlock ${attrs.join(' ')} />`
}
