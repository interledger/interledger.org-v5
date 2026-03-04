/**
 * Ambassador + AmbassadorGrid component handlers for the MDX block parser.
 *
 * Handles:
 * - <Ambassador slug="..." showLinks={true|false} />
 * - <AmbassadorGrid heading="..." slugs={["a","b"]} />
 *
 * Both handlers resolve ambassador slugs to Strapi document IDs
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
): (apiId: string, slug: string) => Promise<{ documentId: string }> {
  return async (apiId: string, slug: string) => {
    const entry = await strapi.findBySlug(apiId, slug, locale)
    if (entry) return { documentId: entry.documentId }

    if (locale !== 'en') {
      const fallback = await strapi.findBySlug(apiId, slug, 'en')
      if (fallback) return { documentId: fallback.documentId }
    }

    throw new MdxParserError({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      message: `Slug "${slug}" could not be resolved for "${apiId}" in locale "${locale}" or "en".`
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
  const slug = getStringAttr(node, 'slug', { required: true })
  const showLinks = getBooleanAttr(node, 'showLinks')

  const { documentId } = await ctx.resolveRelation!('ambassadors', slug)

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
  const slugs = getStringArrayAttr(node, 'slugs', { required: true })

  const resolved = await Promise.all(
    slugs.map((slug) => ctx.resolveRelation!('ambassadors', slug))
  )

  const block: AmbassadorsGridBlock = {
    __component: 'blocks.ambassadors-grid',
    ambassadors: { connect: resolved }
  }

  if (heading !== undefined) {
    block.heading = heading
  }

  return [block]
}

// ---------------------------------------------------------------------------
// Registration (runs on import)
// ---------------------------------------------------------------------------

registerComponentHandler('Ambassador', handleAmbassador)
registerComponentHandler('AmbassadorGrid', handleAmbassadorGrid)
