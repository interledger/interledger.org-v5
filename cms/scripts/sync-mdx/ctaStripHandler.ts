/**
 * CtaStrip component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaStrip
 *     heading="…"              (optional)
 *     primaryButtonText="…"
 *     primaryButtonLink="…"
 *   >description markdown</CtaStrip>
 *
 * Maps to Strapi blocks.cta-strip. The description comes from the JSX
 * children; everything else comes from attributes. Legacy secondary CTA and
 * color attributes are ignored because CTA strips now only support one purple
 * primary CTA.
 */

import type { ParsedBlock, CtaStripBlock } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, tryCatchParserError } from './parserErrors'

async function handleCtaStrip(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = getStringAttr(node, 'heading')
    const primaryButtonText = getStringAttr(node, 'primaryButtonText', {
      required: true
    })
    const primaryButtonLink = getStringAttr(node, 'primaryButtonLink', {
      required: true
    })
    const description =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    const block: CtaStripBlock = {
      __component: 'blocks.cta-strip',
      primaryButtonText,
      primaryButtonLink
    }

    if (heading) block.heading = heading
    if (description) block.description = description

    return [block]
  })
}

registerComponentHandler('CtaStrip', handleCtaStrip)
