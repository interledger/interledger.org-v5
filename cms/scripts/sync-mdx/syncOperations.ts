/**
 * Sync Operations
 *
 * Core functions for syncing MDX content to Strapi CMS:
 * - syncEnglishEntry: Create/update English entries (synced first, as locale parents)
 * - syncLocaleEntry: Create/update localized entries linked to English parents
 * - syncUnmatchedLocales: Handle locale files whose English parent is in Strapi but not MDX
 * - deleteOrphanedEntries: Remove Strapi entries that no longer have MDX files
 *
 * Errors-as-values: each operation returns `T | Error`. Callers in
 * syncCoordinator narrow on the return and increment `results.errors`.
 *
 * All operations support dry-run mode for previewing changes.
 */
import { getLocalesToCheck } from './scan'
import type { MDXFile } from './mdxTypes'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapiClient'
import type { SyncContext, SyncResults } from './types'
import { hasMdxFile } from './localeMatch'

/** Sync a single English entry (create or update). Returns the entry, or Error on failure. */
export async function syncEnglishEntry(
  _contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  englishMdx: MDXFile,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<StrapiEntry | undefined | Error> {
  const existingByIdentifier = await ctx.strapi.findByPathSlug(
    config.apiId,
    englishMdx.pathSlug,
    'en'
  )
  if (existingByIdentifier instanceof Error) return existingByIdentifier

  const englishData = await config.buildPayload(
    englishMdx,
    ctx.strapi,
    existingByIdentifier ?? null,
    dryRun
  )
  if (englishData instanceof Error) return englishData

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
    if (result instanceof Error) return result
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
  if (result instanceof Error) return result
  console.log(`   ✅ Created: ${englishMdx.pathSlug} (en)`)
  results.created++
  return result.data
}

/** Sync a single locale (create or update localization). Returns void on success, Error on failure. */
export async function syncLocaleEntry(
  _contentType: keyof ContentTypes,
  config: ContentTypes[keyof ContentTypes],
  localeMdx: MDXFile,
  englishEntry: StrapiEntry,
  ctx: SyncContext,
  results: SyncResults,
  dryRun: boolean
): Promise<void | Error> {
  const localeCode = localeMdx.locale || 'en'

  const existingLocale = await ctx.strapi.findByPathSlug(
    config.apiId,
    localeMdx.pathSlug,
    localeCode
  )
  if (existingLocale instanceof Error) return existingLocale

  const localeData = await config.buildPayload(
    localeMdx,
    ctx.strapi,
    existingLocale ?? null,
    dryRun
  )
  if (localeData instanceof Error) return localeData

  if (existingLocale) {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would update localization: ${localeMdx.pathSlug} (${localeCode})`
      )
    } else {
      const result = await ctx.strapi.updateLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      if (result instanceof Error) return result
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
      const result = await ctx.strapi.createLocalization(
        config.apiId,
        englishEntry.documentId,
        localeCode,
        localeData
      )
      if (result instanceof Error) return result
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
  if (allStrapiEntries instanceof Error) {
    console.error(
      `      ❌ Error fetching English entries to match unmatched locales: ${allStrapiEntries.message}`
    )
    results.errors++
    return
  }

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

      const result = await syncLocaleEntry(
        contentType,
        config,
        localeMdx,
        matchedEnglishEntry,
        ctx,
        results,
        dryRun
      )
      if (result instanceof Error) {
        console.error(
          `      ❌ Error processing localization ${localeMdx.pathSlug} (${localeCode}): ${result.message}`
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

  // Tracks whether the merged fetch above may have missed entries (e.g. a
  // transient 5xx/network/auth error, as opposed to a "not found" response
  // that just means this locale has no entries). If the fetch is unreliable,
  // allLocalesByDocument below can undercount a document's real locales, so
  // we must not trust it to decide whether a document root is safe to delete.
  let fetchIncomplete = false

  // locale=all first (catches entries per-locale queries may miss).
  // An error here is non-fatal to the sync: locale=all may not be supported,
  // so we fall through to per-locale queries — but if it's not a "not found"
  // response, it still means we can't be sure we've seen every entry.
  const allLocaleResult = await ctx.strapi.getAllEntries(config.apiId, 'all')
  if (!(allLocaleResult instanceof Error)) {
    addBatch(allLocaleResult, 'en')
  } else if (!isNotFoundError(allLocaleResult.message)) {
    fetchIncomplete = true
  }

  // Per-locale queries as safety net. Per-locale errors are also non-fatal
  // to the sync (a locale may not exist for this content type), but a
  // non-404 error here likewise means the fetch may be incomplete.
  const locales = getLocalesToCheck(contentType, contentTypes)
  for (const locale of locales) {
    const localeResult = await ctx.strapi.getAllEntries(config.apiId, locale)
    if (!(localeResult instanceof Error)) {
      addBatch(localeResult, locale)
    } else if (!isNotFoundError(localeResult.message)) {
      fetchIncomplete = true
    }
  }

  // --- 2. Identify orphans and group by documentId ---
  // Track every locale seen per document (not just orphaned ones) so we can
  // tell a full-document orphan (safe to delete the document root) apart
  // from a partial orphan (a sibling locale's MDX file still exists).
  const allLocalesByDocument = new Map<string, Set<string>>()
  for (const entry of allEntries) {
    let locales = allLocalesByDocument.get(entry.documentId)
    if (!locales) {
      locales = new Set()
      allLocalesByDocument.set(entry.documentId, locales)
    }
    locales.add(entry.locale)
  }

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
      const result = await ctx.strapi.deleteLocalization(
        config.apiId,
        documentId,
        locale
      )
      if (result instanceof Error) {
        if (isNotFoundError(result.message)) {
          // Already gone (cascaded delete) — not an error
          results.deleted++
          deletedAny = true
        } else {
          console.error(
            `   ❌ Error deleting ${doc.slugs.get(locale) ?? slugLabel} (${locale}): ${result.message}`
          )
          results.errors++
        }
        continue
      }
      console.log(
        `   🗑️  Deleted: ${doc.slugs.get(locale) ?? slugLabel} (${locale})`
      )
      results.deleted++
      deletedAny = true
    }

    // Clean up document root — only when every locale this document has in
    // Strapi was orphaned. A partial orphan (e.g. only 'es' has no MDX file
    // while 'en' still does) must leave the document root alone, since an
    // unscoped deleteEntry removes ALL locales, not just the orphaned ones.
    // If the fetch that built allLocalesByDocument was incomplete, we can't
    // trust it to represent every locale, so skip the root cleanup entirely.
    const isFullDocumentOrphan =
      !fetchIncomplete &&
      doc.locales.size === (allLocalesByDocument.get(documentId)?.size ?? 0)

    if (deletedAny && isFullDocumentOrphan) {
      const result = await ctx.strapi.deleteEntry(config.apiId, documentId)
      if (result instanceof Error && !isNotFoundError(result.message)) {
        // 404 = document was already fully removed by locale deletes. Expected.
        console.error(
          `   ❌ Error deleting document root ${slugLabel}: ${result.message}`
        )
        results.errors++
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
