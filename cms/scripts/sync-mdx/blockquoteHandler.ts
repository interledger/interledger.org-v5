/**
 * Blockquote component handler for the MDX block parser.
 *
 * Handles:
 * - <Blockquote source="...">quote content</Blockquote>
 *
 * Maps to Strapi blocks.blockquote with `quote` from children
 * and optional `source` from prop.
 */

import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import type { Root } from 'mdast'
import type { ParsedBlock, BlockquoteBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
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

  const quote =
    node.children.length > 0
      ? // mdxJsxToMarkdown is required because remark-mdx parses HTML tags
        // (e.g. <em>, <strong>) as mdxJsxTextElement nodes, which the base
        // toMarkdown serializer does not understand.
        toMarkdown({ type: 'root', children: node.children } as Root, {
          extensions: [mdxJsxToMarkdown()]
        }).trim()
      : ''

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
