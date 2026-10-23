import {
  ckeditorFieldToCompiledMarkdown,
  getImageUrl,
  hasMediaValue,
  serializeIntroProp,
  type BlockIntroInput,
  type CtaButtonEntry
} from '../../utils'
import { escDouble as esc } from '../shared'
import { serializeCtaButtonEntries } from './cta-buttons.serializer'

interface SplitLayoutCta {
  text?: string
  link?: string
  style?: string
  external?: boolean
  document?: boolean
}

type SplitLayoutType =
  'image-text' | 'image-quote' | 'video-text' | 'video-quote'

type SplitLayoutDisplayRatio = '3:2' | '2:1' | '1:1' | '1:2'

const SPLIT_LAYOUT_TYPES = [
  'image-text',
  'image-quote',
  'video-text',
  'video-quote'
] as const

const DISPLAY_RATIOS = ['3:2', '2:1', '1:1', '1:2'] as const

/** A legacy single CTA as a one-button group, or no buttons. */
function legacyCtaButtons(
  cta: SplitLayoutCta | null | undefined
): CtaButtonEntry[] {
  if (!cta?.text || !cta.link) return []
  return [
    {
      text: cta.text,
      link: cta.link,
      style: cta.style ?? 'primary',
      external: cta.external,
      document: cta.document
    }
  ]
}

export function serialize(block: {
  intro?: BlockIntroInput | null
  buttons?: CtaButtonEntry[] | null
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
  /** @deprecated Legacy single CTA; exported as the button group. */
  cta?: SplitLayoutCta | null
}): string {
  const attrs: string[] = []
  const introAttr = serializeIntroProp(block.intro).trim()
  if (introAttr) attrs.push(introAttr)
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

  if ((isImageLayout || isVideoLayout) && imageUrl) {
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
    attrs.push(`quoteSource="${esc(block.quoteSource)}"`)
  }

  if (!block.buttons?.length && block.cta?.external && block.cta?.document) {
    throw new Error(
      'Split layout CTA cannot be both external and document. Pick one: ' +
        'external opens a new tab, document downloads a file.'
    )
  }
  // The button group; a legacy single CTA exports as a one-button group.
  const buttons = block.buttons?.length
    ? block.buttons
    : legacyCtaButtons(block.cta)
  if (isTextLayout && buttons.length > 0) {
    const entries = serializeCtaButtonEntries(buttons)
    attrs.push(`buttons={${JSON.stringify(entries)}}`)
  }

  const raw = isTextLayout ? (block.content ?? '') : ''
  const body = raw ? ckeditorFieldToCompiledMarkdown(raw) : ''
  if (isTextLayout && !body && !introAttr)
    throw new Error('Split layout text variants require content or an intro')
  const attrsStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  if (body) {
    // Blank line is load-bearing: Prettier ignores proseWrap for JSX children
    // flush against tags, but respects it once they're a real paragraph (INTORG-1188).
    return `<SplitLayout${attrsStr}>\n\n${body}\n\n</SplitLayout>`
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
