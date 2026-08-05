/**
 * Block serializers for MDX export.
 * Add a new block: create xxx.serializer.ts + register below.
 */

import {
  toValidationError,
  SerializerFieldError,
  type FieldError
} from '../../utils'
import { serialize as cardsGrid } from './cards-grid.serializer'
import { serialize as cardLinksGrid } from './card-links-grid.serializer'
import { serialize as carousel } from './carousel.serializer'
import { serialize as imageRow } from './image-row.serializer'
import { serialize as paragraph } from './paragraph.serializer'
import { serialize as profile } from './profile.serializer'
import { serialize as profileGrid } from './profile-grid.serializer'
import { serialize as blockquote } from './blockquote.serializer'
import { serialize as calloutText } from './callout-text.serializer'
import { serialize as ctaStrip } from './cta-strip.serializer'
import { serialize as pdfEmbed } from './pdf-embed.serializer'
import { serialize as videoEmbed } from './video-embed.serializer'
import { serialize as imageBlock } from './image-block.serializer'
import { serialize as codeBlock } from './code-block.serializer'
import { serialize as splitLayout } from './split-layout.serializer'
import { serialize as numberTiles } from './number-tiles.serializer'
import {
  serialize as cardGrid,
  sanitizeCardGridsInContent,
  sanitizeCardGridsInDocumentData
} from './card-grid.serializer'
import { serialize as agenda } from './agenda.serializer'
import { serialize as faq } from './faq.serializer'
import { serialize as ctaLink } from './cta-link.serializer'

export { sanitizeCardGridsInDocumentData }

const SERIALIZERS: Record<string, (block: unknown) => string> = {
  'blocks.cards-grid': cardsGrid,
  'blocks.card-links-grid': cardLinksGrid,
  'blocks.carousel': carousel,
  'blocks.number-tiles': numberTiles,
  'blocks.agenda': agenda,

  'blocks.image-row': imageRow,
  'blocks.paragraph': paragraph,
  'blocks.profile': profile,
  'blocks.profile-grid': profileGrid,
  'blocks.blockquote': blockquote,
  'blocks.callout-text': calloutText,
  'blocks.cta-strip': ctaStrip,
  'blocks.pdf-embed': pdfEmbed,
  'blocks.video-embed': videoEmbed,
  'blocks.image-block': imageBlock,
  'blocks.code-block': codeBlock,
  'blocks.split-layout': splitLayout,
  'blocks.card-grid': cardGrid,
  'blocks.faq': faq,
  'shared.cta-link': ctaLink
}

/**
 * Serialize every block in a dynamic zone, collecting failures from every
 * block (not just the first) into one combined error — so an editor sees
 * every problem across the whole zone in a single save attempt.
 */
export function serializeContent(
  content: Array<{ __component: string; [key: string]: unknown }> | undefined
): string {
  if (!content || content.length === 0) return ''

  sanitizeCardGridsInContent(content)

  const blocks: string[] = []
  const fieldErrors: FieldError[] = []

  for (const [index, block] of content.entries()) {
    const fn = SERIALIZERS[block.__component]
    if (!fn) {
      console.warn(`Unknown block component: ${block.__component}`)
      continue
    }
    try {
      blocks.push(fn(block))
    } catch (err) {
      // Prefix with the zone field + block index so the path matches
      // where the admin form actually renders it (content[index].field).
      if (err instanceof SerializerFieldError) {
        for (const fieldError of err.fieldErrors) {
          fieldErrors.push({
            path: ['content', index, ...fieldError.path],
            message: fieldError.message
          })
        }
      } else {
        fieldErrors.push({
          path: ['content', index],
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }

  if (fieldErrors.length > 0) {
    throw toValidationError(new SerializerFieldError(fieldErrors))
  }

  return blocks.join('\n\n')
}

/**
 * Validate required fields on dynamic-zone content blocks by attempting the
 * real serialization and discarding the output. Delegates to `serializeContent`
 * rather than re-checking each block's required fields separately.
 * Returns a `ValidationError` combining every failing field across every
 * block, `undefined` on success.
 *
 * Write-path coverage for Card Grid rules (Resource ≥ 2 cards, One column
 * only for Navigation, etc. via `validateCardGrid`):
 * - Admin UI / Content API / MDX sync → `strapi.documents` create/update →
 *   `registerDocumentValidation` in `cms/src/index.ts` for every content
 *   type that allows `blocks.card-grid` (foundation, summit, hackathon,
 *   grant-overview) plus other DZ hosts that share this helper.
 * - MDX → Strapi sync also rejects invalid grids in `cardGridHandler` before
 *   the REST write, so bad MDX never reaches Strapi.
 * Schema JSON cannot express these cross-field rules; this path is the
 * edit-time gate so the next MDX export cannot fail on already-saved data.
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
