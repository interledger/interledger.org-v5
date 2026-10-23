/**
 * CtaButtons component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaButtons buttons={[{ text, link, style, external, document }, ...]} />
 *
 * Maps to Strapi blocks.cta-buttons. Every field is plain text, so the buttons
 * arrive as a static array prop rather than as child elements (same shape as
 * NumberTiles). `buttons` isn't JSON — Prettier reformats it to JS
 * object-literal syntax on write — so it's read via getStaticLiteralAttr's
 * ESTree evaluator, not JSON.parse.
 */

import type { CtaButtonsBlock, ParsedBlock } from './types.blocks'
import { getIntroAttr } from './jsxExtract'
import { getCtaButtonsAttr } from './ctaButtonsProp'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, tryCatchParserError } from './parserErrors'

async function handleCtaButtons(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const buttons = getCtaButtonsAttr(node, { required: true }) ?? []
    const intro = getIntroAttr(node)
    const block: CtaButtonsBlock = {
      __component: 'blocks.cta-buttons',
      ...(intro ? { intro } : {}),
      buttons
    }

    return [block]
  })
}

registerComponentHandler('CtaButtons', handleCtaButtons)
