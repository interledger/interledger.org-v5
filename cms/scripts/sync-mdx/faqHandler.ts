/**
 * Faq + FaqItem component handler for the MDX block parser.
 *
 * Handles:
 * - <Faq heading="...">
 *     <FaqItem question="...">
 *       answer markdown
 *     </FaqItem>
 *     ...
 *   </Faq>
 *
 * Maps to Strapi blocks.faq.
 * Each <FaqItem> becomes one `items` entry. `heading` is optional.
 */

import type { ParsedBlock, FaqItem, FaqBlock } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getChildElements } from './jsxExtract'
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

function parseFaqItem(node: JsxBlockNode): FaqItem {
  const question = getStringAttr(node, 'question', { required: true })

  const answer =
    node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!answer) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'FaqItem requires non-empty children content for the answer field.',
      component: 'FaqItem',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return { question, answer }
}

async function handleFaq(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = getStringAttr(node, 'heading')

    const itemNodes = getChildElements(node, 'FaqItem')
    if (itemNodes.length === 0) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: 'Faq requires at least one <FaqItem> child.',
        component: 'Faq',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: FaqBlock = {
      __component: 'blocks.faq',
      items: itemNodes.map(parseFaqItem)
    }

    if (heading !== undefined) {
      block.heading = heading
    }

    return [block]
  })
}

registerComponentHandler('Faq', handleFaq)
