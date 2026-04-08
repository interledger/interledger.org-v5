/**
 * Ambassador + AmbassadorGrid component handlers for the MDX block parser.
 *
 * Handles:
 * - <Ambassador pathSlug="..." showLinks={true|false} />
 * - <AmbassadorGrid heading="..." pathSlugs={["a","b"]} />
 *
 * Both handlers resolve ambassador pathSlugs to Strapi document IDs
 * via the generic `resolveRelation` function on ParserContext.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import type { StrapiClient } from './strapiClient'
import type {
  ParsedBlock,
  AmbassadorBlock,
  AmbassadorsGridBlock
} from './types.blocks'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { getStringAttr, getBooleanAttr, getStringArrayAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'

// ---------------------------------------------------------------------------
// Relation resolver factory
// ---------------------------------------------------------------------------

/**
 * Create a relation resolver with locale-first + `en` fallback.
 *
 * Resolution order:
 * 1. Target locale (e.g. `fr`)
 * 2. Fallback to `en` (when target !== 'en')
 * 3. Throw UNRESOLVED_RELATION if neither found
 *
 * The returned function matches the `resolveRelation` signature on
 * ParserContext so it can be plugged in directly.
 */
export function createRelationResolver(
  strapi: StrapiClient,
  locale: string
): (apiId: string, pathSlug: string) => Promise<{ documentId: string }> {
  return async (apiId: string, pathSlug: string) => {
    const entry = await strapi.findByPathSlug(apiId, pathSlug, locale)
    if (entry) return { documentId: entry.documentId }

    if (locale !== 'en') {
      const fallback = await strapi.findByPathSlug(apiId, pathSlug, 'en')
      if (fallback) return { documentId: fallback.documentId }
    }

    throw new MdxParserError({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      message: `pathSlug "${pathSlug}" could not be resolved for "${apiId}" in locale "${locale}" or "en".`
    })
  }
}

// ---------------------------------------------------------------------------
// Ambassador handler
// ---------------------------------------------------------------------------

async function handleAmbassador(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[]> {
  const pathSlug = getStringAttr(node, 'pathSlug', { required: true })
  const showLinks = getBooleanAttr(node, 'showLinks')

  const { documentId } = await ctx.resolveRelation!('ambassadors', pathSlug)

  const block: AmbassadorBlock = {
    __component: 'blocks.ambassador',
    ambassador: { connect: [{ documentId }] }
  }

  if (showLinks !== undefined) {
    block.showLinks = showLinks
  }

  return [block]
}

// ---------------------------------------------------------------------------
// AmbassadorGrid handler
// ---------------------------------------------------------------------------

async function handleAmbassadorGrid(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[]> {
  const heading = getStringAttr(node, 'heading')
  const pathSlugs = getStringArrayAttr(node, 'pathSlugs')
  const category = getStringAttr(node, 'category')

  if (!pathSlugs && !category) {
    throw new MdxParserError({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      message: 'AmbassadorGrid requires either "pathSlugs" or "category".',
      component: node.name ?? undefined,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const block: AmbassadorsGridBlock = {
    __component: 'blocks.ambassadors-grid'
  }

  if (heading !== undefined) {
    block.heading = heading
  }

  if (category !== undefined) {
    block.category = category
  }

  if (pathSlugs && pathSlugs.length > 0) {
    const resolved = await Promise.all(
      pathSlugs.map((pathSlug) => ctx.resolveRelation!('ambassadors', pathSlug))
    )
    block.ambassadors = { connect: resolved }
  }

  return [block]
}

// ---------------------------------------------------------------------------
// Registration (runs on import)
// ---------------------------------------------------------------------------

registerComponentHandler('Ambassador', handleAmbassador)
registerComponentHandler('AmbassadorGrid', handleAmbassadorGrid)
