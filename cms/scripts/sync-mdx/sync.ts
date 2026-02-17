import { scanMDXFiles } from './scan'
import type { ContentTypes } from './config'
import type { SyncContext, SyncResults } from './types'
import { findMatchingLocales, getLocaleBase, addProcessedSlug } from './localeMatch'
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
  const { valid: mdxFiles, invalid } = validateMdxFiles(contentType, scanned)

  if (invalid.length > 0) {
    for (const err of invalid) {
      console.error(`   ⚠️  ${err.filepath}`)
      for (const msg of err.errors) {
        console.error(`      - ${msg}`)
      }
    }
  }

  console.log(`   Found ${mdxFiles.length} MDX files (${invalid.length} invalid skipped)`)

  const results: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: invalid.length
  }

  const processedSlugs = new Map<string, Set<string>>()

  // Include invalid MDX slugs so we don't delete Strapi entries that have MDX files (even if invalid)
  for (const err of invalid) {
    addProcessedSlug(processedSlugs, getLocaleBase(err.locale), err.slug)
  }

  const englishFiles = mdxFiles.filter((mdx) => !mdx.isLocalization)
  const localeFiles = mdxFiles.filter((mdx) => mdx.isLocalization)

  for (const englishMdx of englishFiles) {
    addProcessedSlug(
      processedSlugs,
      getLocaleBase(englishMdx.locale || 'en'),
      englishMdx.slug
    )

    try {
      const englishEntry = await syncEnglishEntry(
        contentType,
        config,
        englishMdx,
        ctx,
        results,
        dryRun
      )

      if (englishEntry && englishEntry.documentId) {
        const matchingLocales = findMatchingLocales(
          englishMdx,
          localeFiles,
          processedSlugs
        )

        for (const candidate of matchingLocales) {
          const localeCode = candidate.localeMdx.locale || 'en'
          const localeForPath = getLocaleBase(localeCode)
          addProcessedSlug(processedSlugs, localeForPath, candidate.localeMdx.slug)

          console.log(
            `      📌 Matched via ${candidate.matchReason}: ${candidate.localeMdx.slug} (${localeCode})`
          )

          try {
            await syncLocaleEntry(
              contentType,
              config,
              candidate.localeMdx,
              englishEntry,
              ctx,
              results,
              dryRun
            )
          } catch (error) {
            console.error(
              `      ❌ Error processing localization ${candidate.localeMdx.slug} (${localeCode}): ${(error as Error).message}`
            )
            results.errors++
          }
        }
      }
    } catch (error) {
      console.error(
        `   ❌ Error processing ${englishMdx.slug} (${englishMdx.locale || 'en'}): ${(error as Error).message}`
      )
      results.errors++
    }
  }

  // Delete orphans first (all locales). Otherwise a locale file would block deletion.
  await deleteOrphanedEntries(
    contentType,
    config,
    ctx.contentTypes,
    processedSlugs,
    ctx,
    results,
    dryRun
  )

  await syncUnmatchedLocales(
    contentType,
    config,
    localeFiles,
    processedSlugs,
    ctx,
    results,
    dryRun
  )

  return results
}

export async function syncAll(ctx: SyncContext, dryRun: boolean): Promise<SyncResults> {
  const allResults: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  }

  for (const contentType of Object.keys(ctx.contentTypes) as Array<
    keyof ContentTypes
  >) {
    try {
      const results = await syncContentType(contentType, ctx, dryRun)
      allResults.created += results.created
      allResults.updated += results.updated
      allResults.deleted += results.deleted
      allResults.errors += results.errors
    } catch (error) {
      console.error(
        `\n❌ Error syncing ${contentType}: ${(error as Error).message}`
      )
      allResults.errors++
    }
  }

  return allResults
}
