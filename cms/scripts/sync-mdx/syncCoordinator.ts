import { scanMDXFiles } from './scan'
import type { ContentTypes } from './config'
import type { MDXFile } from './mdxTypes'
import type { SyncContext, SyncResults } from './types'
import { findMatchingLocales, buildMdxSlugsByLocale } from './localeMatch'
import {
  syncEnglishEntry,
  syncLocaleEntry,
  syncUnmatchedLocales,
  deleteOrphanedEntries
} from './syncOperations'
import { validateMdxFiles } from './validateFrontmatter'
import { formatIdentity, identityForMdx, identityKey } from './entryIdentity'

/**
 * Reject MDX files that resolve to the same Strapi entry.
 *
 * Two files with one identity silently overwrite each other: the sync looks
 * the entry up, finds the one the earlier file just wrote, and updates it
 * again. That is how the foundation FAQ disappeared (INTORG-1132). Fail the
 * content type loudly instead, naming both files.
 *
 * Returns the files that are safe to sync.
 */
function rejectDuplicateIdentities(
  config: ContentTypes[keyof ContentTypes],
  mdxFiles: MDXFile[],
  results: SyncResults
): MDXFile[] {
  const seen = new Map<string, MDXFile>()
  const unique: MDXFile[] = []

  for (const mdx of mdxFiles) {
    const identity = identityForMdx(config, mdx)
    const key = `${mdx.locale || 'en'}:${identityKey(identity)}`
    const first = seen.get(key)

    if (first) {
      console.error(
        `   ❌ Duplicate entry ${formatIdentity(identity)} (${mdx.locale || 'en'})`
      )
      console.error(`      - ${first.filepath}`)
      console.error(`      - ${mdx.filepath}`)
      console.error(
        '      Both files map to one Strapi entry. Give them different pathSlug values.'
      )
      results.errors++
      continue
    }

    seen.set(key, mdx)
    unique.push(mdx)
  }

  return unique
}

export async function syncContentType(
  contentType: keyof ContentTypes,
  ctx: SyncContext,
  dryRun: boolean
): Promise<SyncResults> {
  const config = ctx.contentTypes[contentType]
  console.log(`\n📁 Syncing ${contentType}...`)

  const scanned = scanMDXFiles(contentType, ctx.contentTypes)
  const { valid: validated, invalid } = validateMdxFiles(config, scanned)

  if (invalid.length > 0) {
    for (const err of invalid) {
      console.error(`   ❌  ${err.filepath}`)
      for (const msg of err.errors) {
        console.error(`      - ${msg}`)
      }
    }
  }

  console.log(
    `   Found ${validated.length} MDX files (${invalid.length} invalid skipped)`
  )

  const results: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: invalid.length
  }

  const mdxFiles = rejectDuplicateIdentities(config, validated, results)

  // Build map of all MDX identities by locale (valid + invalid) to prevent deletion
  const mdxSlugsByLocale = buildMdxSlugsByLocale(mdxFiles, config)
  // Add invalid MDX pathSlugs so we don't delete Strapi entries that have MDX files (even if invalid)
  for (const err of invalid) {
    const locale = err.locale || 'en'
    const slugSet = mdxSlugsByLocale.get(locale) ?? new Set()
    slugSet.add(
      identityKey({
        pathSlug: err.pathSlug,
        section: config.sectionScopedIdentity ? (err.section ?? null) : null
      })
    )
    mdxSlugsByLocale.set(locale, slugSet)
  }

  const englishFiles = mdxFiles.filter((mdx) => !mdx.isLocalization)
  const localeFiles = mdxFiles.filter((mdx) => mdx.isLocalization)
  const processedLocaleIdentities = new Set<string>()

  for (const englishMdx of englishFiles) {
    const englishEntry = await syncEnglishEntry(
      contentType,
      config,
      englishMdx,
      ctx,
      results,
      dryRun
    )

    if (englishEntry instanceof Error) {
      console.error(
        `   ❌ Error processing ${formatIdentity(identityForMdx(config, englishMdx))} (${englishMdx.locale || 'en'}): ${englishEntry.message}`
      )
      results.errors++
      continue
    }

    if (englishEntry && englishEntry.documentId) {
      const matchingLocales = findMatchingLocales(
        englishMdx,
        localeFiles,
        config
      )

      for (const candidate of matchingLocales) {
        const localeCode = candidate.localeMdx.locale || 'en'
        processedLocaleIdentities.add(
          `${localeCode}:${identityKey(identityForMdx(config, candidate.localeMdx))}`
        )

        console.log(
          `      📌 Matched via ${candidate.matchReason}: ${candidate.localeMdx.pathSlug} (${localeCode})`
        )

        const localeResult = await syncLocaleEntry(
          contentType,
          config,
          candidate.localeMdx,
          englishEntry,
          ctx,
          results,
          dryRun
        )
        if (localeResult instanceof Error) {
          console.error(
            `      ❌ Error processing localization ${candidate.localeMdx.pathSlug} (${localeCode}): ${localeResult.message}`
          )
          results.errors++
        }
      }
    }
  }

  // Delete orphans first (all locales). Otherwise a locale file would block deletion.
  await deleteOrphanedEntries(
    contentType,
    config,
    ctx.contentTypes,
    mdxSlugsByLocale,
    ctx,
    results,
    dryRun
  )

  await syncUnmatchedLocales(
    contentType,
    config,
    localeFiles,
    processedLocaleIdentities,
    ctx,
    results,
    dryRun
  )

  return results
}

async function syncContentTypeSafely(
  contentType: keyof ContentTypes,
  ctx: SyncContext,
  dryRun: boolean
): Promise<SyncResults> {
  return syncContentType(contentType, ctx, dryRun).catch((error) => {
    // syncContentType doesn't return Error directly (it accumulates errors
    // into the per-content-type SyncResults), but we keep this guard for
    // truly unexpected exceptions (programmer bugs, OOM, etc).
    console.error(
      `\n❌ Error syncing ${contentType}: ${(error as Error).message}`
    )
    return { created: 0, updated: 0, deleted: 0, errors: 1 }
  })
}

function addResults(target: SyncResults, results: SyncResults): void {
  target.created += results.created
  target.updated += results.updated
  target.deleted += results.deleted
  target.errors += results.errors
}

// profile-pages is the only relation target other content types reference
// (ProfileCard/ProfileGrid resolve a profile pathSlug via a live Strapi
// lookup — see profileHandler.ts). It must finish syncing first: on a
// brand-new Strapi instance, a content type and the profile it references
// can both be new in the same run, so syncing everything concurrently
// races the referencing entry against the profile it depends on.
const RELATION_TARGET_TYPE = 'profiles' as const

export async function syncAll(
  ctx: SyncContext,
  dryRun: boolean
): Promise<SyncResults> {
  const allResults: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  }

  const contentTypes = Object.keys(ctx.contentTypes) as Array<
    keyof ContentTypes
  >
  const dependents = contentTypes.filter((t) => t !== RELATION_TARGET_TYPE)

  if (contentTypes.includes(RELATION_TARGET_TYPE)) {
    addResults(
      allResults,
      await syncContentTypeSafely(RELATION_TARGET_TYPE, ctx, dryRun)
    )
  }

  const perTypeResults = await Promise.all(
    dependents.map((contentType) =>
      syncContentTypeSafely(contentType, ctx, dryRun)
    )
  )

  for (const results of perTypeResults) {
    addResults(allResults, results)
  }

  return allResults
}
