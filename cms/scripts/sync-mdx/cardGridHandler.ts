/**
 * CardGrid + nested card handlers for the MDX block parser.
 *
 * <CardGrid ariaLabel="..." variant="..." columns="One|Two|Three">
 *   <TitleCard ...>...</TitleCard>
 *   <ResourceCard ...>...</ResourceCard>
 *   <InfoCard ...>...</InfoCard>
 *   <NavigationCard ... />
 * </CardGrid>
 *
 * Maps to Strapi blocks.card-grid with a variant-specific repeatable field.
 */

import {
  type CardGridBlock,
  type CardGridCard,
  type ParsedBlock
} from './types.blocks'
import {
  CARD_GRID_COLUMNS,
  CARD_GRID_VARIANTS,
  CARD_GRID_VARIANT_CHILDREN,
  CARD_GRID_VARIANT_FIELDS,
  CARD_GRID_VARIANT_LIST_LABEL,
  type CardGridVariant
} from '../../src/utils/cardGrid'
import { childrenToMarkdown } from './mdastSerialize'
import {
  getStringAttr,
  getBooleanAttr,
  getChildElements,
  getMismatchedChildElements,
  getLooseChildText
} from './jsxExtract'
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

function isVariant(value: string): value is CardGridVariant {
  return (CARD_GRID_VARIANTS as readonly string[]).includes(value)
}

function isColumns(value: string): value is (typeof CARD_GRID_COLUMNS)[number] {
  return (CARD_GRID_COLUMNS as readonly string[]).includes(value)
}

function parseSecondaryCta(node: JsxBlockNode, component: string) {
  const link = getStringAttr(node, 'buttonUrl', { required: true })
  const text = getStringAttr(node, 'buttonText', { required: true })
  const external = getBooleanAttr(node, 'buttonExternal') ?? false
  const document = getBooleanAttr(node, 'buttonDocument') ?? false

  if (external && document) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `${component} cannot set both buttonExternal and buttonDocument.`,
      component,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return { link, text, external, document }
}

function parseTitleCard(node: JsxBlockNode): CardGridCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const subHeading = getStringAttr(node, 'subheading')
  const secondaryCta = parseSecondaryCta(node, 'TitleCard')
  const description =
    node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!description) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'TitleCard requires non-empty children for the description.',
      component: 'TitleCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }
  const card: CardGridCard = {
    heading,
    description,
    secondaryCta
  }
  if (subHeading !== undefined) card.subHeading = subHeading
  return card
}

function parseResourceCard(node: JsxBlockNode): CardGridCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const secondaryCta = parseSecondaryCta(node, 'ResourceCard')
  const description =
    node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!description) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'ResourceCard requires non-empty children for the description.',
      component: 'ResourceCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }
  return {
    heading,
    description,
    secondaryCta
  }
}

function parseInfoCard(node: JsxBlockNode): CardGridCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const body = node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!body) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'InfoCard requires non-empty children for the body.',
      component: 'InfoCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }
  return {
    heading,
    body
  }
}

function parseNavigationCard(node: JsxBlockNode): CardGridCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const secondaryCta = parseSecondaryCta(node, 'NavigationCard')
  if (node.children.length > 0) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'NavigationCard is self-closing and does not accept children. Remove the content between the tags.',
      component: 'NavigationCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }
  return {
    heading,
    secondaryCta
  }
}

const PARSERS: Record<CardGridVariant, (node: JsxBlockNode) => CardGridCard> = {
  Title: parseTitleCard,
  Resource: parseResourceCard,
  Info: parseInfoCard,
  Navigation: parseNavigationCard
}

async function handleCardGrid(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const ariaLabel = getStringAttr(node, 'ariaLabel', { required: true })
    const variantAttr = getStringAttr(node, 'variant', { required: true })
    const columns = getStringAttr(node, 'columns', { required: true })

    if (!isVariant(variantAttr)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `CardGrid "variant" must be one of ${CARD_GRID_VARIANT_LIST_LABEL}. Received "${variantAttr}".`,
        component: 'CardGrid',
        prop: 'variant',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (!isColumns(columns)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `CardGrid "columns" must be one of ${CARD_GRID_COLUMNS.join(', ')}. Received "${columns}".`,
        component: 'CardGrid',
        prop: 'columns',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (columns === 'One' && variantAttr !== 'Navigation') {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: 'Only Navigation CardGrid may use columns="One".',
        component: 'CardGrid',
        prop: 'columns',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const childName = CARD_GRID_VARIANT_CHILDREN[variantAttr]
    // Prefer the mismatched-component error over "requires at least one
    // <Expected>" when the author used the wrong card tag for the variant.
    const mismatchedNodes = getMismatchedChildElements(node, childName)
    if (mismatchedNodes.length > 0) {
      const stray = mismatchedNodes[0]!
      throw new MdxParserError({
        code: ParserErrorCode.UNSUPPORTED_COMPONENT,
        message: `CardGrid variant="${variantAttr}" only accepts <${childName}> children. Found <${stray.name ?? 'Fragment'}>.`,
        component: 'CardGrid',
        line: stray.position?.start.line ?? node.position?.start.line,
        column: stray.position?.start.column ?? node.position?.start.column
      })
    }

    // getChildElements only collects matching tags — prose siblings like
    // <InfoCard />Oops would otherwise sync the card and drop "Oops".
    const looseText = getLooseChildText(node)
    if (looseText) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `CardGrid variant="${variantAttr}" only accepts <${childName}> children. Found unexpected text "${looseText.preview}".`,
        component: 'CardGrid',
        line: looseText.line ?? node.position?.start.line,
        column: looseText.column ?? node.position?.start.column
      })
    }

    const cardNodes = getChildElements(node, childName)
    if (cardNodes.length === 0) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: `CardGrid variant="${variantAttr}" requires at least one <${childName}> child.`,
        component: 'CardGrid',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (variantAttr === 'Resource' && cardNodes.length < 2) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: 'Resource CardGrid requires at least two cards.',
        component: 'CardGrid',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const parse = PARSERS[variantAttr]
    const cardsField = CARD_GRID_VARIANT_FIELDS[variantAttr]
    const block: CardGridBlock = {
      __component: 'blocks.card-grid',
      ariaLabel,
      variant: variantAttr,
      columns,
      [cardsField]: cardNodes.map(parse)
    }

    return [block]
  })
}

registerComponentHandler('CardGrid', handleCardGrid)
