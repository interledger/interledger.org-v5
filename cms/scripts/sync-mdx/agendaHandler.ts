/**
 * <Agenda intro={{…}} days={[{ date: 'YYYY-MM-DD', items: [...] }, …]} />
 *
 * `intro` is optional. An agenda written before `days` is one day:
 * `heading={…} items={[...]}`, read as it was until Phase 4 removes it.
 */
import type {
  AgendaBlock,
  AgendaDay,
  AgendaItem,
  ParsedBlock
} from './types.blocks'
import { getIntroAttr, getStaticLiteralAttr } from './jsxExtract'
import { isCalendarDate } from '../../src/utils/calendarDate'
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

function isAgendaDay(value: unknown): value is AgendaDay {
  if (typeof value !== 'object' || value === null) return false
  const day = value as Record<string, unknown>
  return (
    isCalendarDate(day.date) &&
    Array.isArray(day.items) &&
    day.items.length >= MIN_ITEMS &&
    day.items.every(isAgendaItem)
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

function parseDays(node: JsxBlockNode, days: unknown): AgendaDay[] {
  if (!Array.isArray(days) || days.length === 0 || !days.every(isAgendaDay)) {
    throw invalidProp(
      node,
      'days',
      `Prop "days" must be a non-empty array of { date: "YYYY-MM-DD", items } objects, each with at least ${MIN_ITEMS} items of { time, activity, additionalInfo? }.`
    )
  }
  return days.map((day) => ({
    date: day.date,
    items: day.items.map(normalizeItem)
  }))
}

/** The single-day shape every agenda had before `days`. */
function parseLegacyDay(
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
    const days = getStaticLiteralAttr(node, 'days')
    const schedule =
      days === undefined
        ? parseLegacyDay(node)
        : { days: parseDays(node, days) }

    const block: AgendaBlock = {
      __component: 'blocks.agenda',
      ...(intro ? { intro } : {}),
      ...schedule
    }

    return [block]
  })
}

registerComponentHandler('Agenda', handleAgenda)
