import isHtml from 'is-html'
import { getImageUrl, htmlToMarkdown } from '../../utils'
import { escDouble as esc } from '../shared'

interface SplitLayoutCta {
  text?: string
  link?: string
  style?: string
  external?: boolean
}

export function serialize(block: {
  imagePosition?: 'left' | 'right'
  image?: { url?: string; alternativeText?: string } | null
  videoUrl?: string | null
  content?: string | null
  quote?: string | null
  quoteSource?: string | null
  cta?: SplitLayoutCta | null
}): string {
  const attrs: string[] = []

  if (block.imagePosition && block.imagePosition !== 'right') {
    attrs.push(`imagePosition="${esc(block.imagePosition)}"`)
  }

  const imageUrl = getImageUrl(block.image)
  if (imageUrl) {
    attrs.push(`imageSrc="${esc(imageUrl)}"`)
    const alt = block.image?.alternativeText ?? ''
    if (alt) attrs.push(`imageAlt="${esc(alt)}"`)
  }

  if (block.videoUrl) {
    attrs.push(`videoUrl="${esc(block.videoUrl)}"`)
  }

  if (block.quote) {
    attrs.push(`quote="${esc(block.quote)}"`)
  }

  if (block.quoteSource) {
    attrs.push(`quoteSource="${esc(block.quoteSource)}"`)
  }

  const cta = block.cta
  if (cta?.text && cta?.link) {
    attrs.push(`ctaText="${esc(cta.text)}"`)
    attrs.push(`ctaLink="${esc(cta.link)}"`)
    if (cta.style && cta.style !== 'primary') {
      attrs.push(`ctaStyle="${esc(cta.style)}"`)
    }
    if (cta.external) {
      attrs.push(`ctaExternal={true}`)
    }
  }

  const raw = block.content ?? ''
  const body = raw ? (isHtml(raw) ? htmlToMarkdown(raw) : raw).trim() : ''

  const attrsStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  if (body) {
    return `<SplitLayout${attrsStr}>\n${body}\n</SplitLayout>`
  }
  return `<SplitLayout${attrsStr} />`
}
