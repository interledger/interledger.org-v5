import type { AgendaBlock, ParsedBlock } from './types.blocks'
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

const MIN_ITEMS = 2

interface AgendaItem {
  time: string
  activity: string
  additionalInfo: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isAgendaItem(value: unknown): value is AgendaItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    isNonEmptyString(item.time) &&
    isNonEmptyString(item.activity) &&
    isNonEmptyString(item.additionalInfo)
  )
}

async function handleAgenda(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = getStaticLiteralAttr(node, 'heading')
    const items = getStaticLiteralAttr(node, 'items', { required: true })

    if (
      heading !== undefined &&
      heading !== null &&
      !isNonEmptyString(heading)
    ) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: 'Prop "heading" must be a non-empty string when provided.',
        component: 'Agenda',
        prop: 'heading',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (!Array.isArray(items) || !items.every(isAgendaItem)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Prop "items" must be an array of { time, activity, additionalInfo } objects with non-empty string values.',
        component: 'Agenda',
        prop: 'items',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (items.length < MIN_ITEMS) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "items" requires at least ${MIN_ITEMS} agenda items.`,
        component: 'Agenda',
        prop: 'items',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: AgendaBlock = {
      __component: 'blocks.agenda',
      ...(isNonEmptyString(heading) ? { heading: heading.trim() } : {}),
      items: items.map((item) => ({
        time: item.time.trim(),
        activity: item.activity.trim(),
        additionalInfo: item.additionalInfo.trim()
      }))
    }

    return [block]
  })
}

registerComponentHandler('Agenda', handleAgenda)
