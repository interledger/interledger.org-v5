/**
 * Block serializers for MDX export.
 * Add a new block: create xxx.serializer.ts + register below.
 */

import { toValidationError } from '../../utils'
import { serialize as cardsGrid } from './cards-grid.serializer'
import { serialize as cardLinksGrid } from './card-links-grid.serializer'
import { serialize as carousel } from './carousel.serializer'
import { serialize as ctaBanner } from './cta-banner.serializer'
import { serialize as imageRow } from './image-row.serializer'
import { serialize as paragraph } from './paragraph.serializer'
import { serialize as ambassador } from './ambassador.serializer'
import { serialize as ambassadorsGrid } from './ambassadors-grid.serializer'
import { serialize as blockquote } from './blockquote.serializer'
import { serialize as calloutText } from './callout-text.serializer'
import { serialize as ctaStrip } from './cta-strip.serializer'
import { serialize as pdfEmbed } from './pdf-embed.serializer'
import { serialize as videoEmbed } from './video-embed.serializer'
import { serialize as imageBlock } from './image-block.serializer'
import { serialize as codeBlock } from './code-block.serializer'

const SERIALIZERS: Record<string, (block: unknown) => string> = {
  'blocks.cards-grid': cardsGrid,
  'blocks.card-links-grid': cardLinksGrid,
  'blocks.carousel': carousel,
  'blocks.cta-banner': ctaBanner,
  'blocks.image-row': imageRow,
  'blocks.paragraph': paragraph,
  'blocks.ambassador': ambassador,
  'blocks.ambassadors-grid': ambassadorsGrid,
  'blocks.blockquote': blockquote,
  'blocks.callout-text': calloutText,
  'blocks.cta-strip': ctaStrip,
  'blocks.pdf-embed': pdfEmbed,
  'blocks.video-embed': videoEmbed,
  'blocks.image-block': imageBlock,
  'blocks.code-block': codeBlock
}

export function serializeContent(
  content: Array<{ __component: string; [key: string]: unknown }> | undefined
): string {
  if (!content || content.length === 0) return ''

  const blocks: string[] = []
  for (const block of content) {
    const fn = SERIALIZERS[block.__component]
    if (fn) {
      try {
        blocks.push(fn(block))
      } catch (err) {
        throw toValidationError(err)
      }
    } else {
      console.warn(`Unknown block component: ${block.__component}`)
    }
  }
  return blocks.join('\n\n')
}

/**
 * Validate required fields on dynamic-zone content blocks by attempting the
 * real serialization and discarding the output. Delegates to `serializeContent`
 * rather than re-checking each block's required fields separately
 * Returns a `ValidationError` on the first invalid block, `undefined` otherwise.
 */
export function validateContentBlocks(
  content: Array<{ __component: string; [key: string]: unknown }> | undefined
) {
  try {
    serializeContent(content)
    return undefined
  } catch (error) {
    return toValidationError(error)
  }
}
