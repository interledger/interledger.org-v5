/**
 * CardGrid + nested card handlers for the MDX block parser.
 *
 * <CardGrid title="..." ariaLabel="..." variant="..." columns="One|Two|Three">
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

function parseCtaFlags(
  node: JsxBlockNode,
  component: string,
  externalProp: string,
  documentProp: string
): { external?: boolean; document?: boolean } {
  const external = getBooleanAttr(node, externalProp)
  const document = getBooleanAttr(node, documentProp)

  if (external && document) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `${component} cannot set both ${externalProp} and ${documentProp}.`,
      component,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  // Leave omitted flags unset. resolveCtaLink infers external from absolute
  // URLs only when `external` is undefined — an explicit false must stay false.
  const flags: { external?: boolean; document?: boolean } = {}
  if (external !== undefined) flags.external = external
  if (document !== undefined) flags.document = document
  return flags
}

function parseSecondaryCta(node: JsxBlockNode, component: string) {
  const link = getStringAttr(node, 'buttonUrl', { required: true })
  const text = getStringAttr(node, 'buttonText', { required: true })
  return {
    link,
    text,
    ...parseCtaFlags(node, component, 'buttonExternal', 'buttonDocument')
  }
}

function parseOptionalSecondSecondaryCta(
  node: JsxBlockNode,
  component: string
): CardGridCard['secondSecondaryCta'] {
  const link = getStringAttr(node, 'secondButtonUrl')
  const text = getStringAttr(node, 'secondButtonText')
  if (link === undefined && text === undefined) return undefined

  if (!link?.trim() || !text?.trim()) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `${component} requires both secondButtonUrl and secondButtonText when adding a second CTA.`,
      component,
      prop: 'secondButtonUrl',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return {
    link,
    text,
    ...parseCtaFlags(
      node,
      component,
      'secondButtonExternal',
      'secondButtonDocument'
    )
  }
}

function parseTitleCard(node: JsxBlockNode): CardGridCard {
  const heading = getStringAttr(node, 'heading', { required: true })
  const subHeading = getStringAttr(node, 'subheading')
  const secondaryCta = parseSecondaryCta(node, 'TitleCard')
  const secondSecondaryCta = parseOptionalSecondSecondaryCta(node, 'TitleCard')
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
  if (secondSecondaryCta) card.secondSecondaryCta = secondSecondaryCta
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

async function parseInfoCard(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<CardGridCard> {
  const heading = getStringAttr(node, 'heading', { required: true })
  const imageSrc = getStringAttr(node, 'imageSrc')
  const imageAlt = getStringAttr(node, 'imageAlt')
  const body = node.children.length > 0 ? childrenToMarkdown(node.children) : ''

  if (body && imageSrc) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'InfoCard cannot have both body content and imageSrc. Use one or the other.',
      component: 'InfoCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  if (!body && !imageSrc) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'InfoCard requires non-empty children for the body, or an imageSrc.',
      component: 'InfoCard',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const card: CardGridCard = { heading }
  if (body) card.body = body
  if (imageAlt !== undefined) card.imageAlt = imageAlt

  if (imageSrc) {
    if (!ctx.resolveMediaUpload) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message:
          'resolveMediaUpload is required to import InfoCard imageSrc but was not provided.',
        component: 'InfoCard',
        prop: 'imageSrc',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }
    card.image = await ctx.resolveMediaUpload(imageSrc)
  }

  return card
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

const PARSERS: Partial<
  Record<CardGridVariant, (node: JsxBlockNode) => CardGridCard>
> = {
  Title: parseTitleCard,
  Resource: parseResourceCard,
  Navigation: parseNavigationCard
}

async function handleCardGrid(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const ariaLabel = getStringAttr(node, 'ariaLabel', { required: true })
    const title = getStringAttr(node, 'title')
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
    const cards =
      variantAttr === 'Info'
        ? await Promise.all(
            cardNodes.map((cardNode) => parseInfoCard(cardNode, ctx))
          )
        : cardNodes.map((cardNode) => parse!(cardNode))
    const block: CardGridBlock = {
      __component: 'blocks.card-grid',
      ariaLabel,
      variant: variantAttr,
      columns,
      [cardsField]: cards
    }
    if (title?.trim()) block.title = title.trim()

    return [block]
  })
}

registerComponentHandler('CardGrid', handleCardGrid)
