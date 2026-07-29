/**
 * InfoCards + InfoCard component handler for the MDX block parser.
 *
 * Handles:
 * - <InfoCards ariaLabel="..." columns="Two|Three">
 *     <InfoCard heading="...">
 *       markdown body (supports bullets)
 *     </InfoCard>
 *     ...
 *   </InfoCards>
 *
 * Maps to Strapi blocks.info-card-grid.
 */

import {
  INFO_CARD_GRID_COLUMNS,
  type InfoCard,
  type InfoCardGridBlock,
  type ParsedBlock
} from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getChildElements } from './jsxExtract'
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

function isInfoCardGridColumns(
  value: string
): value is InfoCardGridBlock['columns'] {
  return (INFO_CARD_GRID_COLUMNS as readonly string[]).includes(value)
}

function parseInfoCard(node: JsxBlockNode): InfoCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const body = node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!body.trim()) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'InfoCard requires non-empty children content for the description field.',
      component: 'InfoCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return { heading, body }
}

async function handleInfoCards(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const ariaLabel = getStringAttr(node, 'ariaLabel', { required: true })

    // blocks.info-card-grid has no section-heading field — a `heading` prop
    // would render but be silently dropped on the next Strapi round-trip, so
    // reject it loudly instead (this component only supports per-card headings
    // via <InfoCard heading="...">).
    if (getStringAttr(node, 'heading') !== undefined) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'InfoCards does not support a "heading" prop. Remove it — each card has its own heading via <InfoCard heading="...">.',
        component: 'InfoCards',
        prop: 'heading',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const columnsAttr = getStringAttr(node, 'columns') ?? 'Three'
    if (!isInfoCardGridColumns(columnsAttr)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `InfoCards columns must be one of ${INFO_CARD_GRID_COLUMNS.join(', ')}. Received "${columnsAttr}".`,
        component: 'InfoCards',
        prop: 'columns',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const cardNodes = getChildElements(node, 'InfoCard')
    if (cardNodes.length === 0) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: 'InfoCards requires at least one <InfoCard> child.',
        component: 'InfoCards',
        prop: 'children',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const cards = cardNodes.map(parseInfoCard)

    const block: InfoCardGridBlock = {
      __component: 'blocks.info-card-grid',
      ariaLabel,
      columns: columnsAttr,
      cards
    }

    return [block]
  })
}

registerComponentHandler('InfoCards', handleInfoCards)
