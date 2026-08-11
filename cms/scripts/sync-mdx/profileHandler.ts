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
import type {
  ParsedBlock,
  ProfileBlock,
  ProfileGridBlock
} from './types.blocks'
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
 * Create a relation resolver for the target locale.
 *
 * Resolution order:
 * 1. Target locale (e.g. `es`) — required for real writes. Strapi rejects
 *    connect from locale=es to a document that has no `es` version
 *    ("Document with id …, locale es not found"). Never fall back to an EN
 *    documentId on a live sync.
 * 2. Dry-run only: fall back to `en` for readability of dry-run logs when the
 *    related entry exists only in English (still not written).
 * 3. Dry-run only: tolerate a relation not yet in Strapi if its pathSlug is
 *    in `dryRunPathSlugs` (would be created in this same run).
 * 4. Throw UNRESOLVED_RELATION otherwise.
 *
 * The returned function matches the `resolveRelation` signature on
 * ParserContext so it can be plugged in directly. Throws are caught at
 * the handler boundary by `tryCatchParserError` and returned as values.
 */
export function createRelationResolver(
  strapi: StrapiClient,
  locale: string,
  dryRun = false,
  dryRunPathSlugs?: Set<string>
): (apiId: string, pathSlug: string) => Promise<{ documentId: string }> {
  return async (apiId: string, pathSlug: string) => {
    const entry = await strapi.findByPathSlug(apiId, pathSlug, locale)
    if (entry instanceof Error) throw entry
    if (entry) return { documentId: entry.documentId }

    // Live sync: do not connect EN-only relations into a non-en document —
    // Strapi relation transforms require the target locale to exist.
    if (dryRun && locale !== 'en') {
      const fallback = await strapi.findByPathSlug(apiId, pathSlug, 'en')
      if (fallback instanceof Error) throw fallback
      if (fallback) {
        console.log(
          `   ⚠️  [DRY-RUN] Relation "${pathSlug}" (${apiId}) has no "${locale}" locale — using en documentId for dry-run only.`
        )
        return { documentId: fallback.documentId }
      }
    }

    if (dryRun && dryRunPathSlugs?.has(pathSlug)) {
      console.log(
        `   ⚠️  [DRY-RUN] Relation "${pathSlug}" (${apiId}) not yet in Strapi — would be created by this same sync run.`
      )
      return { documentId: `dry-run:${apiId}:${pathSlug}` }
    }

    throw new MdxParserError({
      code: ParserErrorCode.UNRESOLVED_RELATION,
      message: `pathSlug "${pathSlug}" could not be resolved for "${apiId}" in locale "${locale}". Ensure the related entry exists in that locale (EN-only relations cannot be connected from ${locale}).`
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

    if (!ctx.resolveRelation) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message:
          'ProfileCard requires a resolveRelation function on the parser context.'
      })
    }

    const { documentId } = await ctx.resolveRelation('profile-pages', pathSlug)

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
      if (!ctx.resolveRelation) {
        throw new MdxParserError({
          code: ParserErrorCode.MISSING_REQUIRED_PROP,
          message:
            'ProfileGrid with pathSlugs requires a resolveRelation function on the parser context.'
        })
      }
      const resolve = ctx.resolveRelation
      const resolved = await Promise.all(
        pathSlugs.map((pathSlug) => resolve('profile-pages', pathSlug))
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
