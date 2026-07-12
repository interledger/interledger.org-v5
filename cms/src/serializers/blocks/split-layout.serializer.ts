import isHtml from 'is-html'
import { getImageUrl, htmlToMarkdown } from '../../utils'
import { escDouble as esc } from '../shared'

interface SplitLayoutCta {
  text?: string
  link?: string
  style?: string
  external?: boolean
}

type SplitLayoutType =
  | 'image-text'
  | 'image-quote'
  | 'video-text'
  | 'video-quote'

export function serialize(block: {
  layoutType?: SplitLayoutType | null
  imagePosition?: 'left' | 'right'
  image?: { url?: string; alternativeText?: string } | null
  imageAlt?: string | null
  videoUrl?: string | null
  content?: string | null
  quote?: string | null
  quoteSource?: string | null
  cta?: SplitLayoutCta | null
}): string {
  const attrs: string[] = []
  const layoutType = block.layoutType ?? inferLayoutType(block)
  const isImageLayout = layoutType.startsWith('image')
  const isVideoLayout = layoutType.startsWith('video')
  const isTextLayout = layoutType.endsWith('-text')
  const isQuoteLayout = layoutType.endsWith('-quote')

  if (layoutType !== 'image-text') {
    attrs.push(`layoutType="${layoutType}"`)
  }

  if (block.imagePosition && block.imagePosition !== 'right') {
    attrs.push(`imagePosition="${esc(block.imagePosition)}"`)
  }

  const imageUrl = getImageUrl(block.image)
  if (isImageLayout && imageUrl) {
    attrs.push(`imageSrc="${esc(imageUrl)}"`)
    const alt = block.imageAlt ?? block.image?.alternativeText ?? ''
    if (alt) attrs.push(`imageAlt="${esc(alt)}"`)
  }

  if (isVideoLayout && block.videoUrl) {
    attrs.push(`videoUrl="${esc(block.videoUrl)}"`)
  }

  if (isQuoteLayout && block.quote) {
    attrs.push(`quote="${esc(block.quote)}"`)
  }

  if (isQuoteLayout && block.quoteSource) {
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

  const raw = isTextLayout ? (block.content ?? '') : ''
  const body = raw ? (isHtml(raw) ? htmlToMarkdown(raw) : raw).trim() : ''

  const attrsStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  if (body) {
    return `<SplitLayout${attrsStr}>\n${body}\n</SplitLayout>`
  }
  return `<SplitLayout${attrsStr} />`
}

function inferLayoutType(block: {
  videoUrl?: string | null
  quote?: string | null
}): SplitLayoutType {
  if (block.videoUrl) return block.quote ? 'video-quote' : 'video-text'
  return block.quote ? 'image-quote' : 'image-text'
}
