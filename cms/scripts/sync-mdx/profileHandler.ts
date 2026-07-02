/**
 * ProfileCard + ProfileGrid component handlers for the MDX block parser.
 *
 * Handles:
 * - <ProfileCard pathSlug="..." />
 * - <ProfileGrid heading="..." pathSlugs={["a","b"]} />
 * - <ProfileGrid heading="..." category="..." />
 *
 * Both handlers resolve profile pathSlugs to Strapi document IDs
 * via the generic `resolveRelation` function on ParserContext.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import type { StrapiClient } from './strapiClient'
import type { ParsedBlock, ProfileBlock, ProfileGridBlock } from './types.blocks'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'
import { getStringAttr, getStringArrayAttr } from './jsxExtract'
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
 * ParserContext so it can be plugged in directly. Throws are caught at
 * the handler boundary by `tryCatchParserError` and returned as values.
 */
export function createRelationResolver(
  strapi: StrapiClient,
  locale: string
): (apiId: string, pathSlug: string) => Promise<{ documentId: string }> {
  return async (apiId: string, pathSlug: string) => {
    const entry = await strapi.findByPathSlug(apiId, pathSlug, locale)
    if (entry instanceof Error) throw entry
    if (entry) return { documentId: entry.documentId }

    if (locale !== 'en') {
      const fallback = await strapi.findByPathSlug(apiId, pathSlug, 'en')
      if (fallback instanceof Error) throw fallback
      if (fallback) return { documentId: fallback.documentId }
    }

    throw new MdxParserError({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      message: `pathSlug "${pathSlug}" could not be resolved for "${apiId}" in locale "${locale}" or "en".`
    })
  }
}

// ---------------------------------------------------------------------------
// ProfileCard handler
// ---------------------------------------------------------------------------

async function handleProfile(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const pathSlug = getStringAttr(node, 'pathSlug', { required: true })

    const { documentId } = await ctx.resolveRelation!('profile-pages', pathSlug)

    const block: ProfileBlock = {
      __component: 'blocks.profile',
      profile: { connect: [{ documentId }] }
    }

    return [block]
  })
}

// ---------------------------------------------------------------------------
// ProfileGrid handler
// ---------------------------------------------------------------------------

async function handleProfileGrid(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const heading = getStringAttr(node, 'heading')
    const pathSlugs = getStringArrayAttr(node, 'pathSlugs')
    const category = getStringAttr(node, 'category')

    if (!pathSlugs && !category) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: 'ProfileGrid requires either "pathSlugs" or "category".'
      })
    }

    const block: ProfileGridBlock = {
      __component: 'blocks.profile-grid'
    }

    if (heading !== undefined) {
      block.heading = heading
    }
    if (category !== undefined) {
      block.category = category
    }
    if (pathSlugs && pathSlugs.length > 0) {
      const resolved = await Promise.all(
        pathSlugs.map((pathSlug) =>
          ctx.resolveRelation!('profile-pages', pathSlug)
        )
      )
      block.profiles = { connect: resolved }
    }

    return [block]
  })
}

// ---------------------------------------------------------------------------
// Registration (runs on import)
// ---------------------------------------------------------------------------

registerComponentHandler('ProfileCard', handleProfile)
registerComponentHandler('ProfileGrid', handleProfileGrid)
