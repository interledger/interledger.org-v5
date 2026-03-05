/**
 * Blockquote component handler for the MDX block parser.
 *
 * Handles:
 * - <Blockquote source="...">quote content</Blockquote>
 *
 * Maps to Strapi blocks.blockquote with `quote` from children
 * and optional `source` from prop.
 */

import type { ParsedBlock, BlockquoteBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
import { serializeChildrenToMarkdown } from '../../src/utils/markdownSerializer'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

async function handleBlockquote(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[]> {
  const source = getStringAttr(node, 'source')

  const quote = serializeChildrenToMarkdown(node.children)

  if (!quote) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'Blockquote requires non-empty children content for the quote field.',
      component: 'Blockquote',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const block: BlockquoteBlock = {
    __component: 'blocks.blockquote',
    quote
  }

  if (source !== undefined) {
    block.source = source
  }

  return [block]
}

registerComponentHandler('Blockquote', handleBlockquote)
