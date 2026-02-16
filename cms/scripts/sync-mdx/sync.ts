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
  ctx: SyncContext
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

  // Strapi v5 no longer supports locale=all; use 'en' since we only need English entries for orphan detection
  const strapiEntries = await ctx.strapi.getAllEntries(config.apiId, 'en')
  console.log(`   Found ${strapiEntries.length} Strapi entries`)

  const results: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: invalid.length
  }

  const processedSlugs = new Map<string, Set<string>>()
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
        results
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
              results
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

  // Delete orphans first. Otherwise a locale file (e.g. es/sobre-nosotros localizes to about-us)
  // would add the English slug to processedSlugs and block deletion when about-us.mdx is gone.
  await deleteOrphanedEntries(
    config,
    strapiEntries,
    processedSlugs,
    ctx,
    results
  )

  await syncUnmatchedLocales(
    contentType,
    config,
    localeFiles,
    processedSlugs,
    ctx,
    results
  )

  return results
}

export async function syncAll(ctx: SyncContext): Promise<SyncResults> {
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
      const results = await syncContentType(contentType, ctx)
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

export type { SyncContext, SyncResults } from './types'
