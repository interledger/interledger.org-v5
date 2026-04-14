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
  const existingByIdentifier = await ctx.strapi.findByPathSlug(
    config.apiId,
    englishMdx.pathSlug,
    'en'
  )
  const englishData = await config.buildPayload(
    englishMdx,
    ctx.strapi,
    existingByIdentifier ?? null,
    dryRun
  )

  if (existingByIdentifier) {
    if (dryRun) {
      console.log(`   🔄 [DRY-RUN] Would update: ${englishMdx.pathSlug} (en)`)
      results.updated++
      return existingByIdentifier
    }
    const result = await ctx.strapi.updateEntry(
      config.apiId,
      existingByIdentifier.documentId,
      englishData
    )
    console.log(`   🔄 Updated: ${englishMdx.pathSlug} (en)`)
    results.updated++
    return result.data || existingByIdentifier
  }

  if (dryRun) {
    console.log(`   ✅ [DRY-RUN] Would create: ${englishMdx.pathSlug} (en)`)
    results.created++
    return {
      documentId: 'dry-run-id',
      pathSlug: englishMdx.pathSlug
    }
  }

  const result = await ctx.strapi.createEntry(config.apiId, englishData)
  console.log(`   ✅ Created: ${englishMdx.pathSlug} (en)`)
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

  const existingLocale = await ctx.strapi.findByPathSlug(
    config.apiId,
    localeMdx.pathSlug,
    localeCode
  )

  const localeData = await config.buildPayload(
    localeMdx,
    ctx.strapi,
    existingLocale ?? null,
    dryRun
  )

  if (existingLocale) {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would update localization: ${localeMdx.pathSlug} (${localeCode})`
      )
    } else {
      await ctx.strapi.updateLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      console.log(
        `      🌍 Updated localization: ${localeMdx.pathSlug} (${localeCode})`
      )
    }
    results.updated++
  } else {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would create localization: ${localeMdx.pathSlug} (${localeCode})`
      )
    } else {
      await ctx.strapi.createLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      console.log(
        `      🌍 Created localization: ${localeMdx.pathSlug} (${localeCode})`
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
  matchedPathSlugs: Set<string>,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  const unmatchedLocales = localeFiles.filter((localeMdx) => {
    const localeCode = localeMdx.locale || 'en'
    const pathSlugKey = `${localeCode}:${localeMdx.pathSlug}`
    return !matchedPathSlugs.has(pathSlugKey)
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
      ? allStrapiEntries.find((entry) => entry.pathSlug === localeLocalizes)
      : undefined

    if (matchedEnglishEntry) {
      console.log(
        `   Found match in Strapi: ${localeMdx.pathSlug} (${localeCode}) -> ${matchedEnglishEntry.pathSlug} (via localizes)`
      )
      matchedPathSlugs.add(`${localeCode}:${localeMdx.pathSlug}`)

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
          `      ❌ Error processing localization ${localeMdx.pathSlug} (${localeCode}): ${(error as Error).message}`
        )
        results.errors++
      }
    } else {
      console.log(
        `   ⚠️  Could not match: ${localeMdx.pathSlug} (${localeCode})`
      )
      console.log(`      📋 Locale localizes: ${localeLocalizes || 'N/A'}`)
      if (localeLocalizes) {
        console.log(
          `      💡 Looking for English post in Strapi with pathSlug: "${localeLocalizes}"`
        )
        console.log(
          `      💡 If it doesn't exist, create the English post first, then re-run sync`
        )
      } else {
        console.log(
          `      💡 Add 'localizes: "english-path-slug"' to frontmatter to link to English post`
        )
      }
    }
  }
}

/**
 * Delete Strapi entries (any locale) that no longer have a matching MDX file.
 *
 * Uses a merged fetch (locale=all + per-locale) to catch all entries,
 * groups orphans by documentId, deletes non-default locales first,
 * then removes the document root.
 */
export async function deleteOrphanedEntries(
  contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  contentTypes: ContentTypes,
  mdxSlugsByLocale: Map<string, Set<string>>,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  // --- 1. Merged fetch: locale=all + per-locale, deduped ---
  const seen = new Set<string>()
  const allEntries: Array<StrapiEntry & { locale: string }> = []

  function addBatch(batch: StrapiEntry[], fallbackLocale: string) {
    for (const entry of batch) {
      const locale = entry.locale || fallbackLocale
      const key = `${entry.documentId}\0${locale}`
      if (seen.has(key)) continue
      seen.add(key)
      allEntries.push({ ...entry, locale })
    }
  }

  // locale=all first (catches entries per-locale queries may miss)
  try {
    addBatch(await ctx.strapi.getAllEntries(config.apiId, 'all'), 'en')
  } catch {
    // locale=all may not be supported — fall through to per-locale
  }

  // Per-locale queries as safety net
  const locales = getLocalesToCheck(contentType, contentTypes)
  for (const locale of locales) {
    try {
      addBatch(await ctx.strapi.getAllEntries(config.apiId, locale), locale)
    } catch {
      // locale may not exist for this content type
    }
  }

  // --- 2. Identify orphans and group by documentId ---
  const orphansByDocument = new Map<
    string,
    { locales: Set<string>; slugs: Map<string, string> }
  >()

  for (const entry of allEntries) {
    if (hasMdxFile(mdxSlugsByLocale, entry.locale, entry.pathSlug)) continue

    let doc = orphansByDocument.get(entry.documentId)
    if (!doc) {
      doc = { locales: new Set(), slugs: new Map() }
      orphansByDocument.set(entry.documentId, doc)
    }
    doc.locales.add(entry.locale)
    doc.slugs.set(entry.locale, entry.pathSlug)
  }

  // --- 3. Delete: non-default locales first, then default, then document root ---
  for (const [documentId, doc] of orphansByDocument) {
    const sortedLocales = sortLocalesForDelete(doc.locales)
    const slugLabel = doc.slugs.values().next().value ?? documentId

    if (dryRun) {
      console.log(
        `   🗑️  [DRY-RUN] Would delete: ${slugLabel} (${sortedLocales.join(', ')})`
      )
      results.deleted += sortedLocales.length
      continue
    }

    let deletedAny = false
    for (const locale of sortedLocales) {
      try {
        await ctx.strapi.deleteLocalization(config.apiId, documentId, locale)
        console.log(
          `   🗑️  Deleted: ${doc.slugs.get(locale) ?? slugLabel} (${locale})`
        )
        results.deleted++
        deletedAny = true
      } catch (error) {
        if (isNotFoundError((error as Error).message)) {
          // Already gone (cascaded delete) — not an error
          results.deleted++
          deletedAny = true
        } else {
          console.error(
            `   ❌ Error deleting ${doc.slugs.get(locale) ?? slugLabel} (${locale}): ${(error as Error).message}`
          )
          results.errors++
        }
      }
    }

    // Clean up document root
    if (deletedAny) {
      try {
        await ctx.strapi.deleteEntry(config.apiId, documentId)
      } catch (error) {
        // 404 = document was already fully removed by locale deletes. Expected.
        if (!isNotFoundError((error as Error).message)) {
          console.error(
            `   ❌ Error deleting document root ${slugLabel}: ${(error as Error).message}`
          )
          results.errors++
        }
      }
    }
  }
}

/** Non-default locales first (assumes 'en' is default), then 'en'. */
function sortLocalesForDelete(locales: Set<string>): string[] {
  return [...locales].sort((a, b) => {
    if (a === 'en' && b !== 'en') return 1
    if (b === 'en' && a !== 'en') return -1
    return a.localeCompare(b)
  })
}

function isNotFoundError(message: string): boolean {
  return /\b404\b/.test(message) || /not\s*found/i.test(message)
}
