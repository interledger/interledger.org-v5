import { scanMDXFiles } from './scan'
import type { ContentTypes } from './config'
import type { SyncContext, SyncResults } from './types'
import { findMatchingLocales, buildMdxSlugsByLocale } from './localeMatch'
import {
  syncEnglishEntry,
  syncLocaleEntry,
  syncUnmatchedLocales,
  deleteOrphanedEntries
} from './syncOperations'
import { validateMdxFiles } from './validateFrontmatter'

export async function syncContentType(
  contentType: keyof ContentTypes,
  ctx: SyncContext,
  dryRun: boolean
): Promise<SyncResults> {
  const config = ctx.contentTypes[contentType]
  console.log(`\n📁 Syncing ${contentType}...`)

  const scanned = scanMDXFiles(contentType, ctx.contentTypes)
  const { valid: mdxFiles, invalid } = validateMdxFiles(config, scanned)

  if (invalid.length > 0) {
    for (const err of invalid) {
      console.error(`   ❌  ${err.filepath}`)
      for (const msg of err.errors) {
        console.error(`      - ${msg}`)
      }
    }
  }

  console.log(
    `   Found ${mdxFiles.length} MDX files (${invalid.length} invalid skipped)`
  )

  const results: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: invalid.length
  }

  // Build map of all MDX pathSlugs by locale (valid + invalid) to prevent deletion
  const mdxSlugsByLocale = buildMdxSlugsByLocale(mdxFiles)
  // Add invalid MDX pathSlugs so we don't delete Strapi entries that have MDX files (even if invalid)
  for (const err of invalid) {
    const locale = err.locale || 'en'
    const slugSet = mdxSlugsByLocale.get(locale) ?? new Set()
    slugSet.add(err.pathSlug)
    mdxSlugsByLocale.set(locale, slugSet)
  }

  const englishFiles = mdxFiles.filter((mdx) => !mdx.isLocalization)
  const localeFiles = mdxFiles.filter((mdx) => mdx.isLocalization)
  const processedLocalePathSlugs = new Set<string>()

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
        `   ❌ Error processing ${englishMdx.pathSlug} (${englishMdx.locale || 'en'}): ${englishEntry.message}`
      )
      results.errors++
      continue
    }

    if (englishEntry && englishEntry.documentId) {
      const matchingLocales = findMatchingLocales(englishMdx, localeFiles)

      for (const candidate of matchingLocales) {
        const localeCode = candidate.localeMdx.locale || 'en'
        processedLocalePathSlugs.add(
          `${localeCode}:${candidate.localeMdx.pathSlug}`
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
    processedLocalePathSlugs,
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
