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

import {
  hasConflictingCtaFlags,
  type ParsedBlock,
  type CtaStripBlock
} from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
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
    const primaryExternal = getBooleanAttr(node, 'primaryButtonExternal')
    const primaryDocument = getBooleanAttr(node, 'primaryButtonDocument')
    const secondaryExternal = getBooleanAttr(node, 'secondaryButtonExternal')
    const secondaryDocument = getBooleanAttr(node, 'secondaryButtonDocument')

    for (const [label, flags] of [
      ['primary', { external: primaryExternal, document: primaryDocument }],
      [
        'secondary',
        { external: secondaryExternal, document: secondaryDocument }
      ]
    ] as const) {
      if (hasConflictingCtaFlags(flags)) {
        throw new MdxParserError({
          code: ParserErrorCode.INVALID_PROP_VALUE,
          message:
            `CtaStrip ${label} button cannot be both external and document. ` +
            'Pick one: external opens a new tab, document downloads a file.',
          component: 'CtaStrip',
          prop: `${label}ButtonDocument`,
          line: node.position?.start.line,
          column: node.position?.start.column
        })
      }
    }
    const description =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    const block: CtaStripBlock = {
      __component: 'blocks.cta-strip',
      primaryButtonText,
      primaryButtonLink
    }

    if (heading) block.heading = heading
    if (description) block.description = description
    if (primaryExternal) block.primaryButtonExternal = true
    if (primaryDocument) block.primaryButtonDocument = true

    // A half-specified secondary button would render as a dead or unlabelled
    // control, so it only survives when both halves are present.
    //
    // Test the trimmed values, and store them trimmed. The serializer, the
    // renderer and the admin validator all treat a whitespace-only value as
    // empty, so a truthiness test here would let `secondaryButtonText="   "`
    // into Strapi and then drop it again on the way out (Jonathan, #484).
    const secondaryText = secondaryButtonText?.trim()
    const secondaryLink = secondaryButtonLink?.trim()

    // The flags travel with the button. Keeping them when the button itself is
    // dropped would leave Strapi holding a document flag for a link that is
    // not there.
    if (secondaryText && secondaryLink) {
      block.secondaryButtonText = secondaryText
      block.secondaryButtonLink = secondaryLink
      if (secondaryExternal) block.secondaryButtonExternal = true
      if (secondaryDocument) block.secondaryButtonDocument = true
    }

    return [block]
  })
}

registerComponentHandler('CtaStrip', handleCtaStrip)
