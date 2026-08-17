/**
 * EventCard (+ EventWhen / EventWhere / EventApply) handler for MDX → Strapi.
 *
 * Handles:
 * - <EventCard>
 *     <EventWhen title="…" date="…" time="…">optional text</EventWhen>
 *     <EventWhere title="…" location="…">optional text</EventWhere>
 *     <EventApply title="…" buttonText="…" buttonUrl="…" buttonExternal={bool}
 *       buttonDocument={bool}>optional text</EventApply>
 *   </EventCard>
 *
 * Maps to Strapi blocks.event-card. When and Where are required; Apply is
 * optional. Optional body text is JSX children on When, Where, and Apply.
 * EventCard `title` and EventApply `title` are optional.
 */

import type {
  ParsedBlock,
  EventCardBlock,
  EventCardWhen,
  EventCardWhere,
  EventCardApply
} from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getBooleanAttr, getChildElements } from './jsxExtract'
import { hasConflictingCtaFlags } from './types.blocks'
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

function optionalChildrenText(node: JsxBlockNode): string | undefined {
  if (node.children.length === 0) return undefined
  const text = childrenToMarkdown(node.children).trim()
  return text || undefined
}

function parseWhen(node: JsxBlockNode): EventCardWhen {
  const title = getStringAttr(node, 'title', { required: true })
  const date = getStringAttr(node, 'date')
  const time = getStringAttr(node, 'time')
  const text = optionalChildrenText(node)

  const when: EventCardWhen = { title }
  if (date !== undefined) when.date = date
  if (time !== undefined) when.time = time
  if (text !== undefined) when.text = text
  return when
}

function parseWhere(node: JsxBlockNode): EventCardWhere {
  const title = getStringAttr(node, 'title', { required: true })
  const location = getStringAttr(node, 'location')
  const text = optionalChildrenText(node)

  const where: EventCardWhere = { title }
  if (location !== undefined) where.location = location
  if (text !== undefined) where.text = text
  return where
}

function parseApply(node: JsxBlockNode): EventCardApply {
  const title = getStringAttr(node, 'title')
  const buttonText = getStringAttr(node, 'buttonText', { required: true })
  const buttonUrl = getStringAttr(node, 'buttonUrl', { required: true })
  const buttonExternal = getBooleanAttr(node, 'buttonExternal')
  const buttonDocument = getBooleanAttr(node, 'buttonDocument')
  const text = optionalChildrenText(node)

  if (
    hasConflictingCtaFlags({
      external: buttonExternal ?? false,
      document: buttonDocument ?? false
    })
  ) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'EventApply cannot set both buttonExternal and buttonDocument. Pick one: external opens a new tab, document downloads a file.',
      component: 'EventApply',
      prop: 'buttonDocument',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const apply: EventCardApply = {
    primaryCta: {
      text: buttonText,
      link: buttonUrl,
      external: buttonExternal ?? false,
      document: buttonDocument ?? false
    }
  }
  if (title !== undefined) apply.title = title
  if (text !== undefined) apply.text = text
  return apply
}

async function handleEventCard(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const whenNodes = getChildElements(node, 'EventWhen')
    const whereNodes = getChildElements(node, 'EventWhere')
    const applyNodes = getChildElements(node, 'EventApply')

    if (whenNodes.length !== 1) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message:
          'EventCard requires exactly one <EventWhen> child (title is required).',
        component: 'EventCard',
        prop: 'EventWhen',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (whereNodes.length !== 1) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message:
          'EventCard requires exactly one <EventWhere> child (title is required).',
        component: 'EventCard',
        prop: 'EventWhere',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (applyNodes.length > 1) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: 'EventCard accepts at most one <EventApply> child.',
        component: 'EventCard',
        prop: 'EventApply',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const cardTitle = getStringAttr(node, 'title')
    const block: EventCardBlock = {
      __component: 'blocks.event-card',
      when: parseWhen(whenNodes[0]),
      where: parseWhere(whereNodes[0])
    }
    if (cardTitle !== undefined) block.title = cardTitle

    if (applyNodes.length === 1) {
      block.apply = parseApply(applyNodes[0])
    }

    return [block]
  })
}

registerComponentHandler('EventCard', handleEventCard)
