/**
 * PdfEmbed component handler for the MDX block parser.
 *
 * Handles:
 * - <PdfEmbed url="/uploads/file.pdf" analyticsEvent="..." />  (internal)
 * - <PdfEmbed url="https://example.com/file.pdf" analyticsEvent="..." />  (external)
 *
 * Internal paths (starting with '/') are resolved to Strapi upload integer IDs
 * via ctx.resolveMediaUpload. External URLs are stored in externalUrl directly.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import type { ParsedBlock, PdfEmbedBlock } from './types.blocks'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { getStringAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'

async function handlePdfEmbed(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[]> {
  const url = getStringAttr(node, 'url', { required: true })
  const label = getStringAttr(node, 'label')
  const analyticsEvent = getStringAttr(node, 'analyticsEvent', {
    required: true
  })

  const block: PdfEmbedBlock = {
    __component: 'blocks.pdf-embed',
    source: url.startsWith('/') ? 'media_library' : 'external_url',
    analyticsEvent
  }

  if (label !== undefined) {
    block.label = label
  }

  if (block.source === 'media_library') {
    // Internal Strapi media upload — resolve to integer file ID
    const fileId = await ctx.resolveMediaUpload!(url)
    if (!fileId) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message: `Upload "${url}" could not be resolved to a Strapi file ID.`,
        component: 'PdfEmbed'
      })
    }
    block.file = fileId
  } else {
    block.externalUrl = url
  }

  return [block]
}

// Registration (runs on import)
registerComponentHandler('PdfEmbed', handlePdfEmbed)
