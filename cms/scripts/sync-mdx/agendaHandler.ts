/**
 * <Agenda intro={{…}} heading={…} items={[...]} />
 *
 * `intro` and the day `heading` are optional; `items` needs at least two.
 */
import type { AgendaBlock, AgendaItem, ParsedBlock } from './types.blocks'
import { getIntroAttr, getStaticLiteralAttr } from './jsxExtract'
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

const MIN_ITEMS = 2

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string'
}

function isAgendaItem(value: unknown): value is AgendaItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    isNonEmptyString(item.time) &&
    isNonEmptyString(item.activity) &&
    isOptionalString(item.additionalInfo)
  )
}

function invalidProp(
  node: JsxBlockNode,
  prop: string,
  message: string
): MdxParserError {
  return new MdxParserError({
    code: ParserErrorCode.INVALID_PROP_VALUE,
    message,
    component: 'Agenda',
    prop,
    line: node.position?.start.line,
    column: node.position?.start.column
  })
}

function normalizeItem(item: AgendaItem): AgendaItem {
  return {
    time: item.time.trim(),
    activity: item.activity.trim(),
    ...(isNonEmptyString(item.additionalInfo)
      ? { additionalInfo: item.additionalInfo.trim() }
      : {})
  }
}

function parseSchedule(
  node: JsxBlockNode
): Pick<AgendaBlock, 'heading' | 'items'> {
  const heading = getStaticLiteralAttr(node, 'heading')
  const items = getStaticLiteralAttr(node, 'items', { required: true })

  if (heading !== undefined && heading !== null && !isNonEmptyString(heading)) {
    throw invalidProp(
      node,
      'heading',
      'Prop "heading" must be a non-empty string when provided.'
    )
  }

  if (!Array.isArray(items) || !items.every(isAgendaItem)) {
    throw invalidProp(
      node,
      'items',
      'Prop "items" must be an array of { time, activity, additionalInfo? } objects. time and activity must be non-empty strings.'
    )
  }

  if (items.length < MIN_ITEMS) {
    throw invalidProp(
      node,
      'items',
      `Prop "items" requires at least ${MIN_ITEMS} agenda items.`
    )
  }

  return {
    ...(isNonEmptyString(heading) ? { heading: heading.trim() } : {}),
    items: items.map(normalizeItem)
  }
}

async function handleAgenda(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const intro = getIntroAttr(node)
    const schedule = parseSchedule(node)

    const block: AgendaBlock = {
      __component: 'blocks.agenda',
      ...(intro ? { intro } : {}),
      ...schedule
    }

    return [block]
  })
}

registerComponentHandler('Agenda', handleAgenda)
