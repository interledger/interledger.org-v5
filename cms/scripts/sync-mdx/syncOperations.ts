/**
 * Sync Operations
 *
 * Core functions for syncing MDX content to Strapi CMS:
 * - syncEnglishEntry: Create/update English entries (synced first, as locale parents)
 * - syncLocaleEntry: Create/update localized entries linked to English parents
 * - syncUnmatchedLocales: Handle locale files whose English parent is in Strapi but not MDX
 * - deleteOrphanedEntries: Remove Strapi entries that no longer have MDX files
 *
 * All operations support dry-run mode for previewing changes.
 */
import { getLocalesToCheck } from './scan'
import type { MDXFile } from './mdxTypes'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapiClient'
import type { SyncContext, SyncResults } from './types'
import { hasMdxFile } from './localeMatch'

/** Sync a single English entry (create or update). Returns the entry if successful. */
export async function syncEnglishEntry(
  _contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  englishMdx: MDXFile,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<StrapiEntry | undefined> {
  const existing = await ctx.strapi.findBySlug(
    config.apiId,
    englishMdx.slug,
    'en'
  )
  const englishData = await config.buildPayload(
    englishMdx,
    ctx.strapi,
    existing ?? null
  )

  if (existing) {
    if (dryRun) {
      console.log(`   🔄 [DRY-RUN] Would update: ${englishMdx.slug} (en)`)
      results.updated++
      return existing
    }
    const result = await ctx.strapi.updateEntry(
      config.apiId,
      existing.documentId,
      englishData
    )
    console.log(`   🔄 Updated: ${englishMdx.slug} (en)`)
    results.updated++
    return result.data || existing
  }

  if (dryRun) {
    console.log(`   ✅ [DRY-RUN] Would create: ${englishMdx.slug} (en)`)
    results.created++
    return { documentId: 'dry-run-id', slug: englishMdx.slug }
  }

  const result = await ctx.strapi.createEntry(config.apiId, englishData)
  console.log(`   ✅ Created: ${englishMdx.slug} (en)`)
  results.created++
  return result.data
}

/** Sync a single locale (create or update localization). */
export async function syncLocaleEntry(
  _contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  localeMdx: MDXFile,
  englishEntry: StrapiEntry,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  const localeCode = localeMdx.locale || 'en'

  const existingLocale = await ctx.strapi.findBySlug(
    config.apiId,
    localeMdx.slug,
    localeCode
  )

  const localeData = await config.buildPayload(
    localeMdx,
    ctx.strapi,
    existingLocale ?? null
  )

  if (existingLocale) {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would update localization: ${localeMdx.slug} (${localeCode})`
      )
    } else {
      await ctx.strapi.updateLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      console.log(
        `      🌍 Updated localization: ${localeMdx.slug} (${localeCode})`
      )
    }
    results.updated++
  } else {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would create localization: ${localeMdx.slug} (${localeCode})`
      )
    } else {
      await ctx.strapi.createLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      console.log(
        `      🌍 Created localization: ${localeMdx.slug} (${localeCode})`
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
  matchedSlugs: Set<string>,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  const unmatchedLocales = localeFiles.filter((localeMdx) => {
    const localeCode = localeMdx.locale || 'en'
    const slugKey = `${localeCode}:${localeMdx.slug}`
    return !matchedSlugs.has(slugKey)
  })

  if (unmatchedLocales.length === 0) return

  console.log(
    `   🔍 Trying to match ${unmatchedLocales.length} unmatched locale file(s) with Strapi entries...`
  )

  const allStrapiEntries = await ctx.strapi.getAllEntries(config.apiId, 'en')

  for (const localeMdx of unmatchedLocales) {
    const localeCode = localeMdx.locale || 'en'
    const localeLocalizes = localeMdx.localizes

    const matchedEnglishEntry = localeLocalizes
      ? allStrapiEntries.find((entry) => entry.slug === localeLocalizes)
      : undefined

    if (matchedEnglishEntry) {
      console.log(
        `   ✅ Found match in Strapi: ${localeMdx.slug} (${localeCode}) -> ${matchedEnglishEntry.slug} (via localizes)`
      )
      matchedSlugs.add(`${localeCode}:${localeMdx.slug}`)

      try {
        await syncLocaleEntry(
          contentType,
          config,
          localeMdx,
          matchedEnglishEntry,
          ctx,
          results,
          dryRun
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

/** Delete Strapi entries (any locale) that no longer have a matching MDX file. */
export async function deleteOrphanedEntries(
  contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  contentTypes: ContentTypes,
  mdxSlugsByLocale: Map<string, Set<string>>,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  const locales = getLocalesToCheck(contentType, contentTypes)

  for (const locale of locales) {
    const strapiEntries = await ctx.strapi.getAllEntries(config.apiId, locale)

    for (const entry of strapiEntries) {
      const entryLocale = entry.locale || locale

      // Skip if this entry has a corresponding MDX file
      if (hasMdxFile(mdxSlugsByLocale, entryLocale, entry.slug)) continue

      try {
        if (dryRun) {
          console.log(
            `   🗑️  [DRY-RUN] Would delete: ${entry.slug} (${entryLocale})`
          )
        } else {
          await ctx.strapi.deleteLocalization(
            config.apiId,
            entry.documentId,
            entryLocale
          )
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
}
