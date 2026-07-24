/**
 * CtaLink component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaLink text="..." link="..." style="primary|secondary" external={true} />
 *
 * Maps to Strapi shared.cta-link, used directly in a dynamic zone (as
 * opposed to nested inside another component like SplitLayout or Hero).
 */

import type { ParsedBlock, CtaLinkBlock } from './types.blocks'
import { getStringAttr, getBooleanAttr } from './jsxExtract'
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

async function handleCtaLink(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const text = getStringAttr(node, 'text', { required: true })
    const link = getStringAttr(node, 'link', { required: true })
    const style = getStringAttr(node, 'style')
    const external = getBooleanAttr(node, 'external')

    if (style !== undefined && style !== 'primary' && style !== 'secondary') {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `CtaLink "style" must be "primary" or "secondary". Received "${style}".`,
        component: 'CtaLink',
        prop: 'style',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: CtaLinkBlock = {
      __component: 'shared.cta-link',
      text,
      link,
      ...(style ? { style } : {}),
      ...(external ? { external: true } : {})
    }

    return [block]
  })
}

registerComponentHandler('CtaLink', handleCtaLink)
