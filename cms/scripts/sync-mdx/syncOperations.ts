import { type MDXFile } from './scan'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapi'
import type { SyncContext, SyncResults } from './types'
import { buildEntryData } from './entryBuilder'
import { findMatchingLocales } from './localeMatch'

/** Sync a single English entry (create or update). Returns the entry if successful. */
export async function syncEnglishEntry(
  contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  englishMdx: MDXFile,
  ctx: SyncContext,
  results: SyncResults
): Promise<StrapiEntry | undefined> {
  const existing = await ctx.strapi.findBySlug(
    config.apiId,
    englishMdx.slug,
    'en'
  )
  const englishData = buildEntryData(contentType, englishMdx, existing)

  if (existing) {
    if (ctx.DRY_RUN) {
      console.log(`   🔄 [DRY-RUN] Would update: ${englishMdx.slug} (en)`)
      results.updated++
      return existing
    } else {
      const result = await ctx.strapi.updateEntry(
        config.apiId,
        existing.documentId,
        englishData!
      )
      console.log(`   🔄 Updated: ${englishMdx.slug} (en)`)
      results.updated++
      return result.data || existing
    }
  } else {
    if (ctx.DRY_RUN) {
      console.log(`   ✅ [DRY-RUN] Would create: ${englishMdx.slug} (en)`)
      results.created++
      return { documentId: 'dry-run-id', slug: englishMdx.slug }
    } else {
      const result = await ctx.strapi.createEntry(config.apiId, englishData!)
      console.log(`   ✅ Created: ${englishMdx.slug} (en)`)
      results.created++
      return result.data
    }
  }
}

/** Sync a single locale (create or update localization). */
export async function syncLocaleEntry(
  contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  localeMdx: MDXFile,
  englishEntry: StrapiEntry,
  ctx: SyncContext,
  results: SyncResults
): Promise<void> {
  const localeCode = localeMdx.locale || 'en'
  const strapiLocale = localeCode

  let existingLocale = await ctx.strapi.findBySlug(
    config.apiId,
    localeMdx.slug,
    strapiLocale
  )
  if (!existingLocale && strapiLocale !== localeCode) {
    existingLocale = await ctx.strapi.findBySlug(
      config.apiId,
      localeMdx.slug,
      localeCode
    )
  }

  const localeData = buildEntryData(contentType, localeMdx, existingLocale)

  if (existingLocale) {
    if (ctx.DRY_RUN) {
      console.log(
        `      🌍 [DRY-RUN] Would update localization: ${localeMdx.slug} (${strapiLocale})`
      )
    } else {
      await ctx.strapi.updateLocalization(
        config.apiId,
        englishEntry.documentId,
        strapiLocale,
        localeData!
      )
      console.log(
        `      🌍 Updated localization: ${localeMdx.slug} (${strapiLocale})`
      )
    }
    results.updated++
  } else {
    if (ctx.DRY_RUN) {
      console.log(
        `      🌍 [DRY-RUN] Would create localization: ${localeMdx.slug} (${strapiLocale})`
      )
    } else {
      await ctx.strapi.createLocalization(
        config.apiId,
        englishEntry.documentId,
        strapiLocale,
        localeData!
      )
      console.log(
        `      🌍 Created localization: ${localeMdx.slug} (${strapiLocale})`
      )
    }
    results.created++
  }
}

/** Sync unmatched locale files by matching localizes to Strapi English entries. */
export async function syncUnmatchedLocales(
  contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>,
  ctx: SyncContext,
  results: SyncResults
): Promise<void> {
  const unmatchedLocales = localeFiles.filter((localeMdx) => {
    const localeCode = localeMdx.locale || 'en'
    const localeForPath = localeCode.split('-')[0]
    return (
      !processedSlugs.has(localeForPath) ||
      !processedSlugs.get(localeForPath)!.has(localeMdx.slug)
    )
  })

  if (unmatchedLocales.length === 0) return

  console.log(
    `   🔍 Trying to match ${unmatchedLocales.length} unmatched locale file(s) with Strapi entries...`
  )

  const allStrapiEntries = await ctx.strapi.getAllEntries(config.apiId, 'en')

  for (const localeMdx of unmatchedLocales) {
    const localeCode = localeMdx.locale || 'en'
    const localeForPath = localeCode.split('-')[0]
    const localeLocalizes =
      localeMdx.localizes || localeMdx.frontmatter.localizes

    const matchedEnglishEntry = localeLocalizes
      ? allStrapiEntries.find((entry) => entry.slug === localeLocalizes)
      : undefined

    if (matchedEnglishEntry) {
      console.log(
        `   ✅ Found match in Strapi: ${localeMdx.slug} (${localeCode}) -> ${matchedEnglishEntry.slug} (via localizes)`
      )

      if (!processedSlugs.has(localeForPath)) {
        processedSlugs.set(localeForPath, new Set())
      }
      processedSlugs.get(localeForPath)!.add(localeMdx.slug)

      try {
        await syncLocaleEntry(
          contentType,
          config,
          localeMdx,
          matchedEnglishEntry,
          ctx,
          results
        )
      } catch (error) {
        console.error(
          `      ❌ Error processing localization ${localeMdx.slug} (${localeCode}): ${(error as Error).message}`
        )
        results.errors++
      }
    } else {
      console.log(`   ⚠️  Could not match: ${localeMdx.slug} (${localeCode})`)
      console.log(`      📋 Locale localizes: ${localeLocalizes || 'N/A'}`)
      if (localeLocalizes) {
        console.log(
          `      💡 Looking for English post in Strapi with slug: "${localeLocalizes}"`
        )
        console.log(
          `      💡 If it doesn't exist, create the English post first, then re-run sync`
        )
      } else {
        console.log(
          `      💡 Add 'localizes: "english-slug"' to frontmatter to link to English post`
        )
      }
    }
  }
}

/** Delete Strapi entries that no longer have a matching MDX file. */
export async function deleteOrphanedEntries(
  config: ContentTypes[keyof ContentTypes],
  strapiEntries: StrapiEntry[],
  processedSlugs: Map<string, Set<string>>,
  ctx: SyncContext,
  results: SyncResults
): Promise<void> {
  for (const entry of strapiEntries) {
    const entryLocale = entry.locale || 'en'
    const localeForPath = entryLocale.split('-')[0]

    if (localeForPath !== 'en') continue

    const processedSlugsForLocale = processedSlugs.get(localeForPath) || new Set()
    if (processedSlugsForLocale.has(entry.slug)) continue

    try {
      if (ctx.DRY_RUN) {
        console.log(
          `   🗑️  [DRY-RUN] Would delete: ${entry.slug} (${entryLocale})`
        )
      } else {
        await ctx.strapi.deleteEntry(config.apiId, entry.documentId)
        console.log(`   🗑️  Deleted: ${entry.slug} (${entryLocale})`)
      }
      results.deleted++
    } catch (error) {
      console.error(
        `   ❌ Error deleting ${entry.slug} (${entryLocale}): ${(error as Error).message}`
      )
      results.errors++
    }
  }
}
