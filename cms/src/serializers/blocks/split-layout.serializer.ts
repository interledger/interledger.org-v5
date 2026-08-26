import {
  ckeditorFieldToMarkdown,
  ckeditorBreaksToNewlines,
  getImageUrl,
  hasMediaValue
} from '../../utils'
import { escDouble as esc } from '../shared'

interface SplitLayoutCta {
  text?: string
  link?: string
  style?: string
  external?: boolean
  document?: boolean
}

type SplitLayoutType =
  | 'image-text'
  | 'image-quote'
  | 'video-text'
  | 'video-quote'

type SplitLayoutDisplayRatio = '1:1' | '1:2' | '2:1'

const SPLIT_LAYOUT_TYPES = [
  'image-text',
  'image-quote',
  'video-text',
  'video-quote'
] as const

const DISPLAY_RATIOS = ['1:1', '1:2', '2:1'] as const

export function serialize(block: {
  layoutType?: string | null
  imagePosition?: 'left' | 'right'
  displayRatio?: SplitLayoutDisplayRatio | string | null
  media?: {
    image?: { url?: string; alternativeText?: string } | number | null
    alternativeText?: string | null
  } | null
  videoUrl?: string | null
  content?: string | null
  quote?: string | null
  quoteSource?: string | null
  cta?: SplitLayoutCta | null
}): string {
  const attrs: string[] = []
  const layoutType = block.layoutType ?? inferLayoutType(block)
  if (!isSplitLayoutType(layoutType)) {
    throw new Error(
      `Split layout type must be one of ${SPLIT_LAYOUT_TYPES.join(', ')}. Received "${layoutType}".`
    )
  }

  const isImageLayout = layoutType.startsWith('image')
  const isVideoLayout = layoutType.startsWith('video')
  const isTextLayout = layoutType.endsWith('-text')
  const isQuoteLayout = layoutType.endsWith('-quote')

  const imageObj =
    typeof block.media?.image === 'object' ? block.media.image : undefined
  const imageUrl = getImageUrl(imageObj)
  if (isImageLayout && !hasMediaValue(block.media?.image))
    throw new Error('Split layout image variants require an image')
  if (isVideoLayout && !block.videoUrl)
    throw new Error('Split layout video variants require videoUrl')
  if (isQuoteLayout && !block.quote)
    throw new Error('Split layout quote variants require quote')

  if (layoutType !== 'image-text') {
    attrs.push(`layoutType="${layoutType}"`)
  }

  if (block.imagePosition && block.imagePosition !== 'right') {
    attrs.push(`imagePosition="${esc(block.imagePosition)}"`)
  }

  if (block.displayRatio && block.displayRatio !== '2:1') {
    if (!isDisplayRatio(block.displayRatio)) {
      throw new Error(
        `Split layout displayRatio must be one of ${DISPLAY_RATIOS.join(', ')}. Received "${block.displayRatio}".`
      )
    }
    attrs.push(`displayRatio="${esc(block.displayRatio)}"`)
  }

  if (isImageLayout && imageUrl) {
    attrs.push(`imageSrc="${esc(imageUrl)}"`)
    const alt = block.media?.alternativeText ?? imageObj?.alternativeText ?? ''
    if (alt) attrs.push(`imageAlt="${esc(alt)}"`)
  }

  if (isVideoLayout && block.videoUrl) {
    attrs.push(`videoUrl="${esc(block.videoUrl)}"`)
  }

  if (isQuoteLayout && block.quote) {
    attrs.push(`quote="${esc(block.quote)}"`)
  }

  if (isQuoteLayout && block.quoteSource) {
    // quoteSource is forwarded to Blockquote.astro's `source` prop, parsed
    // as markdown via parseMarkdownInline (marked) — see blockquote's own
    // serializer for why this uses \n/\n\n instead of literal <br>.
    attrs.push(
      `quoteSource="${esc(ckeditorBreaksToNewlines(block.quoteSource))}"`
    )
  }

  const cta = block.cta
  if (cta?.external && cta?.document) {
    throw new Error(
      'Split layout CTA cannot be both external and document. Pick one: ' +
        'external opens a new tab, document downloads a file.'
    )
  }
  if (isTextLayout && cta?.text && cta?.link) {
    attrs.push(`ctaText="${esc(cta.text)}"`)
    attrs.push(`ctaLink="${esc(cta.link)}"`)
    if (cta.style && cta.style !== 'primary') {
      attrs.push(`ctaStyle="${esc(cta.style)}"`)
    }
    if (cta.external) {
      attrs.push(`ctaExternal={true}`)
    }
    if (cta.document) {
      attrs.push(`ctaDocument={true}`)
    }
  }

  const raw = isTextLayout ? (block.content ?? '') : ''
  const body = raw ? ckeditorFieldToMarkdown(raw) : ''
  if (isTextLayout && !body)
    throw new Error('Split layout text variants require content')
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

function isSplitLayoutType(value: string): value is SplitLayoutType {
  return SPLIT_LAYOUT_TYPES.includes(value as SplitLayoutType)
}

function isDisplayRatio(value: string): value is SplitLayoutDisplayRatio {
  return DISPLAY_RATIOS.includes(value as SplitLayoutDisplayRatio)
}
