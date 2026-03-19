/**
 * Block serializers for MDX export.
 * Add a new block: create xxx.serializer.ts + register below.
 */

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
import { serialize as pdfEmbed } from './pdf-embed.serializer'

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
  'blocks.pdf-embed': pdfEmbed
}

export function serializeContent(
  content: Array<{ __component: string; [key: string]: unknown }> | undefined
): string {
  if (!content || content.length === 0) return ''

  const blocks: string[] = []
  for (const block of content) {
    const fn = SERIALIZERS[block.__component]
    if (fn) {
      blocks.push(fn(block))
    } else {
      console.warn(`Unknown block component: ${block.__component}`)
    }
  }
  return blocks.join('\n\n')
}
