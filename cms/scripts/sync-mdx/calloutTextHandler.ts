/**
 * CalloutText component handler for the MDX block parser.
 *
 * Handles:
 * - <CalloutText>content</CalloutText>
 *
 * Maps to Strapi blocks.callout-text with `content` from children.
 */

import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import type { Root } from 'mdast'
import type { ParsedBlock, CalloutTextBlock } from './types.blocks'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

async function handleCalloutText(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[]> {
  const content =
    node.children.length > 0
      ? // mdxJsxToMarkdown is required because remark-mdx parses HTML tags
        // (e.g. <em>, <strong>) as mdxJsxTextElement nodes, which the base
        // toMarkdown serializer does not understand.
        toMarkdown({ type: 'root', children: node.children } as Root, {
          extensions: [mdxJsxToMarkdown()]
        }).trim()
      : ''

  if (!content) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'CalloutText requires non-empty children content.',
      component: 'CalloutText',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const block: CalloutTextBlock = {
    __component: 'blocks.callout-text',
    content
  }

  return [block]
}

registerComponentHandler('CalloutText', handleCalloutText)
