/**
 * Quote component handler for the MDX block parser.
 *
 * Handles:
 * - <Quote
 *     authorName="…"   (optional)
 *     authorImage="…"  (optional repo path, resolved to a Strapi upload ID)
 *     authorLink="…"   (optional URL)
 *   >quoted text</Quote>
 *
 * Maps to Strapi blocks.quote. The quote body comes from the JSX children.
 */

import type { ParsedBlock, QuoteBlock } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

async function handleQuote(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const authorName = getStringAttr(node, 'authorName')
    const authorImage = getStringAttr(node, 'authorImage')
    const authorLink = getStringAttr(node, 'authorLink')

    const quote =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    if (!quote.trim()) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Quote requires non-empty children content for the quote field.',
        component: 'Quote',
        prop: 'children',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: QuoteBlock = {
      __component: 'blocks.quote',
      quote
    }

    if (authorName) block.authorName = authorName
    if (authorLink) block.authorLink = authorLink

    if (authorImage) {
      if (!ctx.resolveMediaUpload) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message:
            'resolveMediaUpload is required to import Quote authorImage but was not provided.',
          component: 'Quote',
          prop: 'authorImage',
          line: node.position?.start.line,
          column: node.position?.start.column
        })
      }
      block.authorImage = await ctx.resolveMediaUpload(authorImage)
    }

    return [block]
  })
}

registerComponentHandler('Quote', handleQuote)
