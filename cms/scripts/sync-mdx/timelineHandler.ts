/**
 * Timeline component handler for the MDX block parser. Handles:
 * <Timeline sections={[{ heading, subheading, description, events: [{ date, description, tag }] }, ...]} />
 *
 * Maps to Strapi blocks.timeline. Every field is plain text with a fixed
 * shape, so the sections arrive as a static array prop rather than as child
 * elements — the same shape as NumberTiles and DonationCards. `sections`
 * isn't JSON (Prettier rewrites it to JS object-literal syntax on write), so
 * it is read through getStaticLiteralAttr's ESTree evaluator, not JSON.parse.
 *
 * Validation lives in `normalizeTimelineSections`, shared with the serializer,
 * so import and export cannot disagree about what a complete timeline is.
 */

import {
  normalizeTimelineSections,
  type ParsedBlock,
  type TimelineBlock
} from './types.blocks'
import { getStaticLiteralAttr } from './jsxExtract'
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

async function handleTimeline(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const rawSections = getStaticLiteralAttr(node, 'sections', {
      required: true
    })

    const sections = normalizeTimelineSections(rawSections)
    if (sections instanceof Error) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Prop "sections" must be an array of { heading, subheading, description, events: [{ date, description, tag }] } objects. ' +
          sections.message,
        component: 'Timeline',
        prop: 'sections',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: TimelineBlock = {
      __component: 'blocks.timeline',
      sections
    }

    return [block]
  })
}

registerComponentHandler('Timeline', handleTimeline)
