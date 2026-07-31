/**
 * NumberTiles component handler for the MDX block parser. Handles:
 * <NumberTiles tiles={[{ number, prefix, suffix, description }, ...]} />
 *
 * `tiles` isn't JSON — Prettier reformats it to JS object-literal syntax on
 * write — so it's extracted via getStaticLiteralAttr's ESTree evaluator, not
 * JSON.parse. No media resolution needed: every field is plain text.
 */

import type { ParsedBlock, NumberTilesBlock } from './types.blocks'
import { getStaticLiteralAttr } from './jsxExtract'
import { registerComponentHandler } from './mdxBlockParser'
import type { JsxBlockNode, ParserContext } from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

const MIN_TILES = 2

interface TileEntry {
  number: string
  prefix?: string
  suffix?: string
  description: string
}

/** An optional affix is valid when omitted entirely or non-blank — an empty
 * string would round-trip to Strapi as a field that renders nothing. */
function isValidAffix(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'string' && value.trim().length > 0)
  )
}

function isTileEntry(value: unknown): value is TileEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.number === 'string' &&
    record.number.trim().length > 0 &&
    typeof record.description === 'string' &&
    record.description.trim().length > 0 &&
    isValidAffix(record.prefix) &&
    isValidAffix(record.suffix)
  )
}

async function handleNumberTiles(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const rawTiles = getStaticLiteralAttr(node, 'tiles', { required: true })

    if (!Array.isArray(rawTiles) || !rawTiles.every(isTileEntry)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Prop "tiles" must be an array of { number, description, prefix?, suffix? } objects.',
        component: 'NumberTiles',
        prop: 'tiles',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (rawTiles.length < MIN_TILES) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "tiles" requires at least ${MIN_TILES} tiles.`,
        component: 'NumberTiles',
        prop: 'tiles',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: NumberTilesBlock = {
      __component: 'blocks.number-tiles',
      tiles: rawTiles.map((tile) => {
        const number = tile.number.trim()
        const description = tile.description.trim()
        const prefix = tile.prefix?.trim()
        const suffix = tile.suffix?.trim()
        return {
          number,
          ...(prefix ? { prefix } : {}),
          ...(suffix ? { suffix } : {}),
          description
        }
      })
    }

    return [block]
  })
}

registerComponentHandler('NumberTiles', handleNumberTiles)
