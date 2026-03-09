/**
 * Paragraph component handler for the MDX block parser.
 *
 * Handles:
 * - <Paragraph>markdown content</Paragraph>
 * - <Paragraph content="markdown string" />
 *
 * Maps to Strapi blocks.paragraph.
 */

import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import type { ParsedBlock, ParagraphBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

async function handleParagraph(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[]> {
  // Prefer content prop if present: <Paragraph content="..." />
  const contentAttr = getStringAttr(node, 'content')

  let content: string
  if (contentAttr !== undefined) {
    content = contentAttr
  } else {
    // Otherwise extract from children: <Paragraph>...children...</Paragraph>
    const children = node.children
    content =
      children && children.length > 0
        ? // mdxJsxToMarkdown is required because remark-mdx parses HTML tags
          // (e.g. <em>, <strong>) as mdxJsxTextElement nodes, which the base
          // toMarkdown serializer does not understand.
          toMarkdown({ type: 'root', children } as Root, {
            extensions: [mdxJsxToMarkdown()],
            bullet: '-'
          }).trim()
        : ''
  }

  if (!content) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'Paragraph requires non-empty content. Strapi blocks.paragraph has content as required.',
      component: 'Paragraph',
      prop: 'content',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return [buildParagraphBlock(node, content)]
}

function buildParagraphBlock(
  node: JsxBlockNode,
  content: string
): ParagraphBlock {
  const alignment = getStringAttr(node, 'alignment')
  const block: ParagraphBlock = {
    __component: 'blocks.paragraph',
    content
  }
  if (alignment === 'center' || alignment === 'right') {
    block.alignment = alignment
  }
  return block
}

registerComponentHandler('Paragraph', handleParagraph)
