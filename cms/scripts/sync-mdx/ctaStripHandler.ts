/**
 * CtaStrip component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaStrip
 *     heading="…"              (optional)
 *     primaryButtonText="…"
 *     primaryButtonLink="…"
 *     secondaryButtonText="…"  (optional)
 *     secondaryButtonLink="…"  (optional)
 *   >description markdown</CtaStrip>
 *
 * Maps to Strapi blocks.cta-strip. The description comes from the JSX
 * children; everything else comes from attributes. Strips are always purple,
 * so there is no colour attribute. The secondary CTA needs both its text and
 * its link to render; either one alone is dropped.
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
    const secondaryButtonText = getStringAttr(node, 'secondaryButtonText')
    const secondaryButtonLink = getStringAttr(node, 'secondaryButtonLink')
    const description =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    const block: CtaStripBlock = {
      __component: 'blocks.cta-strip',
      primaryButtonText,
      primaryButtonLink
    }

    if (heading) block.heading = heading
    if (description) block.description = description

    // A half-specified secondary button would render as a dead or unlabelled
    // control, so it only survives when both halves are present.
    if (secondaryButtonText && secondaryButtonLink) {
      block.secondaryButtonText = secondaryButtonText
      block.secondaryButtonLink = secondaryButtonLink
    }

    return [block]
  })
}

registerComponentHandler('CtaStrip', handleCtaStrip)
