/**
 * TitleCardGrid + TitleCard component handler for the MDX block parser.
 *
 * Handles legacy:
 * - <TitleCardGrid ariaLabel="..." columns="Two|Three">
 *     <TitleCard ...>...</TitleCard>
 *   </TitleCardGrid>
 *
 * Emits Strapi blocks.card-grid with variant Title (unified card grid).
 */

import {
  TITLE_CARD_GRID_COLUMNS,
  type CardGridBlock,
  type ParsedBlock,
  type TitleCardGridBlock
} from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getBooleanAttr, getChildElements } from './jsxExtract'
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

function isTitleCardGridColumns(
  value: string
): value is TitleCardGridBlock['columns'] {
  return (TITLE_CARD_GRID_COLUMNS as readonly string[]).includes(value)
}

function parseTitleCard(node: JsxBlockNode) {
  const heading = getStringAttr(node, 'heading', { required: true })
  const subHeading = getStringAttr(node, 'subheading')
  const buttonUrl = getStringAttr(node, 'buttonUrl', { required: true })
  const buttonText = getStringAttr(node, 'buttonText', { required: true })
  const buttonExternal = getBooleanAttr(node, 'buttonExternal')
  const buttonDocument = getBooleanAttr(node, 'buttonDocument')

  const description =
    node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!description) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'TitleCard requires non-empty children content for the description field.',
      component: 'TitleCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return {
    heading,
    ...(subHeading !== undefined ? { subHeading } : {}),
    description,
    secondaryCta: {
      link: buttonUrl,
      text: buttonText,
      external: buttonExternal ?? false,
      document: buttonDocument ?? false
    }
  }
}

async function handleTitleCardGrid(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const ariaLabel = getStringAttr(node, 'ariaLabel', { required: true })
    const columns = getStringAttr(node, 'columns', { required: true })

    if (!isTitleCardGridColumns(columns)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `TitleCardGrid "columns" must be one of ${TITLE_CARD_GRID_COLUMNS.join(', ')}. Received "${columns}".`,
        component: 'TitleCardGrid',
        prop: 'columns',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const cardNodes = getChildElements(node, 'TitleCard')
    if (cardNodes.length === 0) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: 'TitleCardGrid requires at least one <TitleCard> child.',
        component: 'TitleCardGrid',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: CardGridBlock = {
      __component: 'blocks.card-grid',
      ariaLabel,
      variant: 'Title',
      columns,
      titleCards: cardNodes.map(parseTitleCard)
    }

    return [block]
  })
}

registerComponentHandler('TitleCardGrid', handleTitleCardGrid)
