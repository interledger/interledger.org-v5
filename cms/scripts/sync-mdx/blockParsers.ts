/**
 * Block parsers — MDX JSX components → Strapi block objects.
 *
 * Each parser takes an mdxJsxFlowElement AST node and returns a Strapi
 * component payload (with `__component`).  These are the inverse of the
 * serializers in `cms/src/serializers/blocks/`.
 *
 * Parsers enforce strict mode: missing required props or unsupported
 * expression types throw descriptive errors rather than silently producing
 * corrupt data.
 */

import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import {
  getStringAttr,
  getNumberAttr,
  getBooleanAttr,
  getStringArrayAttr,
  getChildrenText
} from './jsxExtract'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrapiBlock {
  __component: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireStringAttr(node: MdxJsxFlowElement, name: string): string {
  const val = getStringAttr(node, name)
  if (val === undefined) {
    throw new Error(
      `Missing required prop '${name}' on <${node.name ?? 'unknown'}>`
    )
  }
  return val
}

// ---------------------------------------------------------------------------
// Simple block parsers (self-closing or simple text children)
// ---------------------------------------------------------------------------

/**
 * `<Ambassador name="..." slug="..." ... />`
 * → `blocks.ambassador` (relation resolved later)
 */
export function parseAmbassador(node: MdxJsxFlowElement): StrapiBlock {
  const slug = requireStringAttr(node, 'slug')
  const showLinks = getBooleanAttr(node, 'showLinks')

  return {
    __component: 'blocks.ambassador',
    // Store slug now; relation resolution happens in Phase 5
    ambassador: slug,
    ...(showLinks !== undefined ? { showLinks } : {})
  }
}

/**
 * `<AmbassadorGrid heading="..." slugs={["a","b"]} />`
 * → `blocks.ambassadors-grid`
 */
export function parseAmbassadorsGrid(node: MdxJsxFlowElement): StrapiBlock {
  const heading = getStringAttr(node, 'heading')
  const slugs = getStringArrayAttr(node, 'slugs') ?? []

  return {
    __component: 'blocks.ambassadors-grid',
    ...(heading !== undefined ? { heading } : {}),
    ambassadors: slugs
  }
}

/**
 * `<Blockquote source="**Jane**, Acme">Quote text here.</Blockquote>`
 * → `blocks.blockquote`
 */
export function parseBlockquote(node: MdxJsxFlowElement): StrapiBlock {
  const source = getStringAttr(node, 'source')
  const quote = getChildrenText(node)

  // Undo the escaping done by the serializer: \{ → { and \} → }
  const unescapedQuote = quote.replace(/\\\{/g, '{').replace(/\\\}/g, '}')

  return {
    __component: 'blocks.blockquote',
    quote: unescapedQuote,
    ...(source !== undefined ? { source } : {})
  }
}

/**
 * `<CalloutText>content here</CalloutText>`
 * → `blocks.callout-text`
 */
export function parseCalloutText(node: MdxJsxFlowElement): StrapiBlock {
  const content = getChildrenText(node)
  // Undo the escaping done by the serializer
  const unescaped = content.replace(/\\\{/g, '{').replace(/\\\}/g, '}')

  return {
    __component: 'blocks.callout-text',
    content: unescaped
  }
}

/**
 * `<CtaBanner title="..." ctaText="..." ctaUrl="..." backgroundColor="...">description</CtaBanner>`
 * → `blocks.cta-banner`
 */
export function parseCtaBanner(node: MdxJsxFlowElement): StrapiBlock {
  const title = requireStringAttr(node, 'title')
  const ctaText = getStringAttr(node, 'ctaText')
  const ctaUrl = getStringAttr(node, 'ctaUrl')
  const backgroundColor = getStringAttr(node, 'backgroundColor')
  const description = getChildrenText(node)

  return {
    __component: 'blocks.cta-banner',
    title,
    ...(description ? { description } : {}),
    ...(ctaText !== undefined ? { ctaText } : {}),
    ...(ctaUrl !== undefined ? { ctaUrl } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {})
  }
}

/**
 * ```
 * <ImageRow>
 *   ![alt text](/img/photo.jpg)
 * </ImageRow>
 * ```
 * → `blocks.image-row`
 *
 * The serializer outputs markdown image syntax inside the component.
 * We parse the children to extract image nodes.
 */
export function parseImageRow(node: MdxJsxFlowElement): StrapiBlock {
  const images: Array<{ url: string; alternativeText: string }> = []

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      // Paragraph may contain inline images
      for (const inline of (
        child as { children?: { type: string; url?: string; alt?: string }[] }
      ).children ?? []) {
        if (inline.type === 'image') {
          images.push({
            url: inline.url ?? '',
            alternativeText: inline.alt ?? ''
          })
        }
      }
    }
  }

  return {
    __component: 'blocks.image-row',
    images
  }
}

// ---------------------------------------------------------------------------
// Container block parsers (contain child JSX elements)
// ---------------------------------------------------------------------------

/**
 * ```
 * <CardsGrid columns={3}>
 *   <Card title="..." link="..." linkText="..." icon="...">description</Card>
 * </CardsGrid>
 * ```
 * → `blocks.cards-grid`
 *
 * Heading and subheading may appear as markdown nodes before the `<CardsGrid>` tag
 * in the serialized output (as ## heading / paragraph). The AST walker handles
 * those as separate nodes and attaches them via `attachPrecedingHeading`.
 */
export function parseCardsGrid(node: MdxJsxFlowElement): StrapiBlock {
  const columns = getNumberAttr(node, 'columns') ?? 3

  const cards: Array<Record<string, unknown>> = []
  for (const child of node.children) {
    if (
      child.type === 'mdxJsxFlowElement' &&
      (child as MdxJsxFlowElement).name === 'Card'
    ) {
      const cardNode = child as MdxJsxFlowElement
      const title = requireStringAttr(cardNode, 'title')
      const link = getStringAttr(cardNode, 'link')
      const linkText = getStringAttr(cardNode, 'linkText')
      const icon = getStringAttr(cardNode, 'icon')
      const openInNewTab = getBooleanAttr(cardNode, 'openInNewTab')
      const description = getChildrenText(cardNode)

      cards.push({
        title,
        ...(description ? { description } : {}),
        ...(link !== undefined ? { link } : {}),
        ...(linkText !== undefined ? { linkText } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(openInNewTab !== undefined ? { openInNewTab } : {})
      })
    }
    // Ignore whitespace text nodes between cards
  }

  return {
    __component: 'blocks.cards-grid',
    columns: String(columns),
    cards
  }
}

/**
 * ```
 * <CardLinksGrid>
 *   <CardLink title="..." url="..." icon="...">description</CardLink>
 * </CardLinksGrid>
 * ```
 * → `blocks.card-links-grid`
 */
export function parseCardLinksGrid(node: MdxJsxFlowElement): StrapiBlock {
  const links: Array<Record<string, unknown>> = []

  for (const child of node.children) {
    if (
      child.type === 'mdxJsxFlowElement' &&
      (child as MdxJsxFlowElement).name === 'CardLink'
    ) {
      const linkNode = child as MdxJsxFlowElement
      const title = requireStringAttr(linkNode, 'title')
      const url = getStringAttr(linkNode, 'url')
      // The schema uses 'href' but the serializer uses 'url'
      const href = url ?? getStringAttr(linkNode, 'href')
      const icon = getStringAttr(linkNode, 'icon')
      const openInNewTab = getBooleanAttr(linkNode, 'openInNewTab')
      const description = getChildrenText(linkNode)

      links.push({
        title,
        ...(description ? { description } : {}),
        ...(href !== undefined ? { href } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(openInNewTab !== undefined ? { openInNewTab } : {})
      })
    }
  }

  return {
    __component: 'blocks.card-links-grid',
    links
  }
}

/**
 * ```
 * <Carousel>
 *   <CarouselItem title="..." image="/img/..." link="/...">description</CarouselItem>
 * </Carousel>
 * ```
 * → `blocks.carousel`
 */
export function parseCarousel(node: MdxJsxFlowElement): StrapiBlock {
  const items: Array<Record<string, unknown>> = []

  for (const child of node.children) {
    if (
      child.type === 'mdxJsxFlowElement' &&
      (child as MdxJsxFlowElement).name === 'CarouselItem'
    ) {
      const itemNode = child as MdxJsxFlowElement
      const title = requireStringAttr(itemNode, 'title')
      const image = getStringAttr(itemNode, 'image')
      const link = getStringAttr(itemNode, 'link')
      const description = getChildrenText(itemNode)

      items.push({
        title,
        ...(description ? { description } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(link !== undefined ? { link } : {})
      })
    }
  }

  return {
    __component: 'blocks.carousel',
    items
  }
}

// ---------------------------------------------------------------------------
// Component name → parser dispatch map
// ---------------------------------------------------------------------------

/** Maps JSX component names to their parser functions. */
export const BLOCK_PARSERS: Record<
  string,
  (node: MdxJsxFlowElement) => StrapiBlock
> = {
  Ambassador: parseAmbassador,
  AmbassadorGrid: parseAmbassadorsGrid,
  Blockquote: parseBlockquote,
  CalloutText: parseCalloutText,
  CtaBanner: parseCtaBanner,
  ImageRow: parseImageRow,
  CardsGrid: parseCardsGrid,
  CardLinksGrid: parseCardLinksGrid,
  Carousel: parseCarousel
}
