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
 *    ("Document with id …, locale es not found").
 * 2. Dry-run only: if the relation exists only in EN, warn and fall through —
 *    this would fail on live sync so dry-run should reflect that.
 * 3. Dry-run only: tolerate a relation not yet in Strapi if its locale-keyed
 *    pathSlug (`${locale}:${pathSlug}`) is in `dryRunPathSlugs` (would be
 *    created in this same run).
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
    const matches = await strapi.findAllByPathSlug(apiId, pathSlug, locale)
    if (matches instanceof Error) throw matches

    // A relation names a pathSlug and nothing else, but pathSlug on a
    // cross-section type is section-relative, so it can match more than one
    // entry (INTORG-1132). Picking the first would silently link whichever
    // Strapi happened to return, so refuse and say which sections collide.
    if (matches.length > 1) {
      const sections = matches
        .map((m) => (m.section as string | undefined) ?? 'no section')
        .join(', ')
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message: `pathSlug "${pathSlug}" matches ${matches.length} "${apiId}" entries in locale "${locale}" (sections: ${sections}). A relation cannot say which one it means, so give them distinct pathSlug values.`
      })
    }

    const entry = matches[0]
    if (entry) return { documentId: entry.documentId }

    // Strapi rejects connecting an EN-only document into a non-EN entry.
    // Log the problem so it is visible in dry-run output, then fall through
    // to the throw so dry-run accurately reflects what the live sync would do.
    if (dryRun && locale !== 'en') {
      const fallback = await strapi.findByPathSlug(apiId, pathSlug, 'en')
      if (fallback instanceof Error) throw fallback
      if (fallback) {
        console.warn(
          `   ⚠️  [DRY-RUN] Relation "${pathSlug}" (${apiId}) has no "${locale}" locale — this would fail on live sync.`
        )
      }
    }

    if (dryRun && dryRunPathSlugs?.has(`${locale}:${pathSlug}`)) {
      console.log(
        `   ⚠️  [DRY-RUN] Relation "${pathSlug}" (${apiId}) not yet in Strapi for "${locale}" — would be created by this same sync run.`
      )
      return { documentId: `dry-run:${apiId}:${locale}:${pathSlug}` }
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
