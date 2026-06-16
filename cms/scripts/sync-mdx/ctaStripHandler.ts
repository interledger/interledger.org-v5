/**
 * CtaStrip component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaStrip
 *     heading="…"
 *     primaryButtonText="…"
 *     primaryButtonLink="…"
 *     secondaryButtonText="…"   (optional)
 *     secondaryButtonLink="…"   (optional)
 *     color="purple|green"      (optional, defaults to "purple")
 *   >description markdown</CtaStrip>
 *
 * Maps to Strapi blocks.cta-strip. The description comes from the JSX
 * children; everything else comes from attributes.
 */

import type { ParsedBlock, CtaStripBlock } from './types.blocks'
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

const VALID_COLORS = ['purple', 'green'] as const
const DEFAULT_COLOR: CtaStripBlock['color'] = 'purple'

async function handleCtaStrip(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = getStringAttr(node, 'heading', { required: true })
    const primaryButtonText = getStringAttr(node, 'primaryButtonText', {
      required: true
    })
    const primaryButtonLink = getStringAttr(node, 'primaryButtonLink', {
      required: true
    })
    const secondaryButtonText = getStringAttr(node, 'secondaryButtonText')
    const secondaryButtonLink = getStringAttr(node, 'secondaryButtonLink')
    const color = getStringAttr(node, 'color')

    const description =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    if (!description) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'CtaStrip requires non-empty children content for the description field.',
        component: 'CtaStrip',
        prop: 'children',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    // Secondary CTA is all-or-nothing.
    if (
      (secondaryButtonText === undefined) !==
      (secondaryButtonLink === undefined)
    ) {
      throw new MdxParserError({
        code: ParserErrorCode.CONFLICTING_PROPS,
        message:
          'CtaStrip secondary CTA requires both "secondaryButtonText" and "secondaryButtonLink", or neither.',
        component: 'CtaStrip',
        prop: 'secondaryButtonText',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (
      color !== undefined &&
      !VALID_COLORS.includes(color as CtaStripBlock['color'])
    ) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `CtaStrip "color" must be one of: ${VALID_COLORS.join(', ')}. Received "${color}".`,
        component: 'CtaStrip',
        prop: 'color',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: CtaStripBlock = {
      __component: 'blocks.cta-strip',
      heading,
      description,
      primaryButtonText,
      primaryButtonLink,
      color: (color as CtaStripBlock['color']) ?? DEFAULT_COLOR
    }

    if (secondaryButtonText !== undefined) {
      block.secondaryButtonText = secondaryButtonText
    }
    if (secondaryButtonLink !== undefined) {
      block.secondaryButtonLink = secondaryButtonLink
    }

    return [block]
  })
}

registerComponentHandler('CtaStrip', handleCtaStrip)
