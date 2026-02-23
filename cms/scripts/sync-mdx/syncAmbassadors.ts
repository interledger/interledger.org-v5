/**
 * Ambassador sync with i18n support.
 *
 * Ambassadors differ from page content types in two ways:
 *   1. Their `photo` field is a Strapi media upload relation — looked up by URL
 *      using the Upload API before writing to Strapi.
 *   2. Only `description` is localised; name, photo, and URL fields are shared
 *      across all locales from the English base entry.
 *
 * Strapi v5 stores non-localised fields per-locale row internally (and syncs them
 * on update), so locale payloads must include them — not just `description`.
 * `syncAmbassadorLocale` therefore receives `sharedData` built from the English MDX.
 *
 * Scan layout:
 *   src/content/ambassadors/           → English (base) entries
 *   src/content/{locale}/ambassadors/  → Localisations
 *
 * Reference: the deleted sync-mdx.cjs syncAmbassadors() at
 * https://github.com/interledger/interledger.org-v5/blob/49f54ab1694937538d88493dde3a6b40f5426bf9/cms/scripts/sync-mdx.cjs#L870
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getContentPath } from '@/utils/paths'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { SyncResults } from './types'
import type { MDXFile } from './scan'
import {
  buildMdxSlugsByLocale,
  findMatchingLocales,
  hasMdxFile
} from './localeMatch'

const API_ID = 'ambassadors'

/** Coerce YAML null / "null" / empty-string values to null. */
function nullOrValue(v: unknown): string | null {
  if (v === 'null' || v == null || v === '') return null
  return String(v)
}

/**
 * Non-localised fields that must be included in every locale payload.
 * Strapi v5 stores these per-locale row even though changes sync across locales.
 */
interface AmbassadorSharedData {
  photoId: number | null
  name: string | null
  linkedinUrl: string | null
  grantReportUrl: string | null
}

function scanDir(
  baseDir: string,
  locale: string,
  isLocalization: boolean
): MDXFile[] {
  const files: MDXFile[] = []
  if (!fs.existsSync(baseDir)) return files

  let filenames: string[]
  try {
    filenames = fs.readdirSync(baseDir)
  } catch (error) {
    console.error(`Failed to read directory: ${baseDir}`, error)
    return files
  }

  for (const filename of filenames) {
    if (!filename.endsWith('.mdx')) continue

    const filepath = path.join(baseDir, filename)
    let fileContent: string
    try {
      fileContent = fs.readFileSync(filepath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filepath}`, error)
      continue
    }

    const { data: frontmatter, content } = matter(fileContent)
    const slug =
      typeof frontmatter.slug === 'string'
        ? frontmatter.slug
        : filename.replace(/\.mdx$/, '')
    const fileLocale = (frontmatter.locale as string) || locale
    const localizes = (frontmatter.localizes as string) || null

    files.push({
      file: filename,
      filepath,
      slug,
      locale: fileLocale,
      frontmatter,
      content: content.trim(),
      isLocalization,
      localizes
    })
  }

  return files
}

function scanAllAmbassadorFiles(projectRoot: string): MDXFile[] {
  const baseDir = getContentPath(projectRoot, 'ambassadors')
  const files = scanDir(baseDir, 'en', false)

  // Scan locale dirs: src/content/{locale}/ambassadors/
  const contentRoot = path.dirname(baseDir)
  if (!fs.existsSync(contentRoot)) return files

  let localeDirs: fs.Dirent[]
  try {
    localeDirs = fs.readdirSync(contentRoot, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read content root: ${contentRoot}`, error)
    return files
  }

  for (const entry of localeDirs) {
    if (!entry.isDirectory() || entry.name === 'ambassadors') continue
    const localeDir = path.join(contentRoot, entry.name, 'ambassadors')
    if (!fs.existsSync(localeDir)) continue
    files.push(...scanDir(localeDir, entry.name, true))
  }

  return files
}

/** Sync a single localised ambassador entry (create or update localization). */
async function syncAmbassadorLocale(
  localeMdx: MDXFile,
  englishDocumentId: string,
  sharedData: AmbassadorSharedData,
  strapi: StrapiClient,
  results: SyncResults,
  dryRun: boolean
): Promise<void> {
  const localeCode = localeMdx.locale || 'en'

  // Include non-localised fields in the locale payload.
  // Even though Strapi marks these as "shared", it stores them per-locale row
  // and requires them to be present when creating or updating a locale entry.
  const localeData: Record<string, unknown> = {
    slug: localeMdx.slug,
    name: sharedData.name,
    description: nullOrValue(localeMdx.frontmatter.description),
    ...(sharedData.photoId ? { photo: sharedData.photoId } : {}),
    linkedinUrl: sharedData.linkedinUrl,
    grantReportUrl: sharedData.grantReportUrl,
    publishedAt: new Date().toISOString()
  }

  const existing = await strapi.findBySlug(API_ID, localeMdx.slug, localeCode)

  if (existing) {
    if (dryRun) {
      console.log(
        `      🌍 [DRY-RUN] Would update localization: ${localeMdx.slug} (${localeCode})`
      )
    } else {
      await strapi.updateLocalization(
        API_ID,
        englishDocumentId,
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
      await strapi.createLocalization(
        API_ID,
        englishDocumentId,
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

export async function syncAmbassadors(
  projectRoot: string,
  strapi: StrapiClient,
  dryRun: boolean
): Promise<SyncResults> {
  console.log('\n📁 Syncing ambassadors...')

  const allFiles = scanAllAmbassadorFiles(projectRoot)
  const englishFiles = allFiles.filter((f) => !f.isLocalization)
  const localeFiles = allFiles.filter((f) => f.isLocalization)

  console.log(
    `   Found ${allFiles.length} MDX files (${englishFiles.length} en, ${localeFiles.length} localisation(s))`
  )

  const results: SyncResults = { created: 0, updated: 0, deleted: 0, errors: 0 }
  const processedLocaleSlugs = new Set<string>()

  // Build slug map across ALL files — used to protect entries from orphan deletion.
  const mdxSlugsByLocale = buildMdxSlugsByLocale(allFiles)

  // Map for quick shared-data lookup in the unmatched-locale pass.
  const englishMdxBySlug = new Map(englishFiles.map((f) => [f.slug, f]))

  // ── English (base) entries ───────────────────────────────────────────────

  for (const mdx of englishFiles) {
    try {
      // Photo lookup: translate the MDX file URL into a Strapi upload file ID.
      const photoUrl = nullOrValue(mdx.frontmatter.photo)
      const photoId = photoUrl ? await strapi.findUploadByUrl(photoUrl) : null
      if (photoUrl && !photoId) {
        console.warn(
          `   ⚠️  Photo not found in Strapi uploads for "${mdx.slug}": ${photoUrl}`
        )
      }

      const sharedData: AmbassadorSharedData = {
        photoId,
        name: nullOrValue(mdx.frontmatter.name),
        linkedinUrl: nullOrValue(mdx.frontmatter.linkedinUrl),
        grantReportUrl: nullOrValue(mdx.frontmatter.grantReportUrl)
      }

      const data: Record<string, unknown> = {
        name: sharedData.name,
        slug: mdx.slug,
        description: nullOrValue(mdx.frontmatter.description),
        ...(photoId ? { photo: photoId } : {}),
        linkedinUrl: sharedData.linkedinUrl,
        grantReportUrl: sharedData.grantReportUrl,
        publishedAt: new Date().toISOString()
      }

      const existing = await strapi.findBySlug(API_ID, mdx.slug, 'en')
      let englishEntry: StrapiEntry | undefined = existing

      if (existing) {
        if (dryRun) {
          console.log(`   🔄 [DRY-RUN] Would update: ${mdx.slug} (en)`)
          results.updated++
        } else {
          const result = await strapi.updateEntry(
            API_ID,
            existing.documentId,
            data
          )
          console.log(`   🔄 Updated: ${mdx.slug} (en)`)
          results.updated++
          englishEntry = result.data || existing
        }
      } else {
        if (dryRun) {
          console.log(`   ✅ [DRY-RUN] Would create: ${mdx.slug} (en)`)
          results.created++
          englishEntry = { documentId: 'dry-run-id', slug: mdx.slug }
        } else {
          const result = await strapi.createEntry(API_ID, data)
          console.log(`   ✅ Created: ${mdx.slug} (en)`)
          results.created++
          englishEntry = result.data
        }
      }

      // ── Matched locale files ─────────────────────────────────────────────
      if (englishEntry?.documentId) {
        const matchingLocales = findMatchingLocales(mdx, localeFiles)
        for (const { localeMdx, matchReason } of matchingLocales) {
          const localeCode = localeMdx.locale || 'en'
          processedLocaleSlugs.add(`${localeCode}:${localeMdx.slug}`)
          console.log(
            `      📌 Matched via ${matchReason}: ${localeMdx.slug} (${localeCode})`
          )
          try {
            await syncAmbassadorLocale(
              localeMdx,
              englishEntry.documentId,
              sharedData,
              strapi,
              results,
              dryRun
            )
          } catch (error) {
            console.error(
              `      ❌ Error processing localization ${localeMdx.slug} (${localeCode}): ${(error as Error).message}`
            )
            results.errors++
          }
        }
      }
    } catch (error) {
      console.error(
        `   ❌ Error processing ${mdx.slug}: ${(error as Error).message}`
      )
      results.errors++
    }
  }

  // ── Unmatched locale files ────────────────────────────────────────────────

  const unmatchedLocales = localeFiles.filter((f) => {
    const key = `${f.locale || 'en'}:${f.slug}`
    return !processedLocaleSlugs.has(key)
  })

  if (unmatchedLocales.length > 0) {
    console.log(
      `   🔍 Trying to match ${unmatchedLocales.length} unmatched locale file(s) with Strapi entries...`
    )
    const allEnglishEntries = await strapi.getAllEntries(API_ID, 'en')

    for (const localeMdx of unmatchedLocales) {
      const localeCode = localeMdx.locale || 'en'
      const matched = localeMdx.localizes
        ? allEnglishEntries.find((e) => e.slug === localeMdx.localizes)
        : undefined

      if (matched) {
        // Build shared data from the local English MDX if available.
        const englishMdx = localeMdx.localizes
          ? englishMdxBySlug.get(localeMdx.localizes)
          : undefined

        let sharedData: AmbassadorSharedData = {
          photoId: null,
          name: null,
          linkedinUrl: null,
          grantReportUrl: null
        }
        if (englishMdx) {
          const photoUrl = nullOrValue(englishMdx.frontmatter.photo)
          const photoId = photoUrl
            ? await strapi.findUploadByUrl(photoUrl)
            : null
          sharedData = {
            photoId,
            name: nullOrValue(englishMdx.frontmatter.name),
            linkedinUrl: nullOrValue(englishMdx.frontmatter.linkedinUrl),
            grantReportUrl: nullOrValue(englishMdx.frontmatter.grantReportUrl)
          }
        }

        try {
          await syncAmbassadorLocale(
            localeMdx,
            matched.documentId,
            sharedData,
            strapi,
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
        if (localeMdx.localizes) {
          console.log(
            `      💡 Looking for English ambassador with slug: "${localeMdx.localizes}"`
          )
        } else {
          console.log(
            `      💡 Add 'localizes: "english-slug"' to frontmatter to link to the English ambassador`
          )
        }
      }
    }
  }

  // ── Orphan deletion per locale ────────────────────────────────────────────

  const localesToCheck = [
    'en',
    ...new Set(
      localeFiles.map((f) => f.locale || 'en').filter((l) => l !== 'en')
    )
  ]

  for (const locale of localesToCheck) {
    const strapiEntries = await strapi.getAllEntries(API_ID, locale)
    for (const entry of strapiEntries) {
      const entryLocale = (entry.locale as string) || locale
      if (hasMdxFile(mdxSlugsByLocale, entryLocale, entry.slug)) continue

      try {
        if (dryRun) {
          console.log(
            `   🗑️  [DRY-RUN] Would delete: ${entry.slug} (${entryLocale})`
          )
        } else {
          await strapi.deleteLocalization(API_ID, entry.documentId, entryLocale)
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

  return results
}
