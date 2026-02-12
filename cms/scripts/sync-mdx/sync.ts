import { scanMDXFiles } from './scan'
import type { ContentTypes } from './config'
import type { SyncContext, SyncResults } from './types'
import { findMatchingLocales } from './localeMatch'
import {
  syncEnglishEntry,
  syncLocaleEntry,
  syncUnmatchedLocales,
  deleteOrphanedEntries
} from './syncOperations'

export async function syncContentType(
  contentType: keyof ContentTypes,
  ctx: SyncContext
): Promise<SyncResults> {
  const config = ctx.contentTypes[contentType]
  console.log(`\n📁 Syncing ${contentType}...`)

  const mdxFiles = scanMDXFiles(contentType, ctx.contentTypes)
  console.log(`   Found ${mdxFiles.length} MDX files`)

  const strapiEntries = await ctx.strapi.getAllEntries(config.apiId)
  console.log(`   Found ${strapiEntries.length} Strapi entries`)

  const results: SyncResults = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  }

  const processedSlugs = new Map<string, Set<string>>()
  const englishFiles = mdxFiles.filter((mdx) => !mdx.isLocalization)
  const localeFiles = mdxFiles.filter((mdx) => mdx.isLocalization)

  for (const englishMdx of englishFiles) {
    const locale = englishMdx.locale || 'en'
    if (!processedSlugs.has(locale)) {
      processedSlugs.set(locale, new Set())
    }
    processedSlugs.get(locale)!.add(englishMdx.slug)

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
          const localeForPath = localeCode.split('-')[0]

          if (!processedSlugs.has(localeForPath)) {
            processedSlugs.set(localeForPath, new Set())
          }
          processedSlugs.get(localeForPath)!.add(candidate.localeMdx.slug)

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
        `   ❌ Error processing ${englishMdx.slug} (${locale}): ${(error as Error).message}`
      )
      results.errors++
    }
  }

  await syncUnmatchedLocales(
    contentType,
    config,
    localeFiles,
    processedSlugs,
    ctx,
    results
  )

  await deleteOrphanedEntries(
    config,
    strapiEntries,
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

export { buildEntryData, getEntryField } from './entryBuilder'
export type { SyncContext, SyncResults } from './types'
