import { marked } from 'marked'
import { scanMDXFiles, type MDXFile } from './scan'

marked.use({ headerIds: false })
import type { ContentTypes } from './config'
import type { StrapiClient, StrapiEntry } from './strapi'

interface SyncContext {
  contentTypes: ContentTypes
  strapi: StrapiClient
  DRY_RUN: boolean
}

interface SyncResults {
  created: number
  updated: number
  deleted: number
  errors: number
}

function getEntryField(entry: StrapiEntry | null, key: string): unknown {
  if (!entry) return null
  return entry[key] ?? (entry as Record<string, unknown>).attributes?.[key as keyof typeof entry] ?? null
}

const PAGE_TYPES = ['foundation-pages', 'summit-pages'] as const
const SUMMIT_PAGE_TYPES = ['summit-pages'] as const

function isPageType(contentType: keyof ContentTypes): boolean {
  return PAGE_TYPES.includes(contentType as typeof PAGE_TYPES[number])
}

function isSummitPageType(contentType: keyof ContentTypes): boolean {
  return SUMMIT_PAGE_TYPES.includes(contentType as typeof SUMMIT_PAGE_TYPES[number])
}

function buildEntryData(
  contentType: keyof ContentTypes,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null
): Record<string, unknown> | null {
  if (contentType === 'blog') {
    return {
      title: mdx.frontmatter.title,
      description: mdx.frontmatter.description,
      slug: mdx.slug,
      date: mdx.frontmatter.date,
      content: marked.parse(mdx.content),
      publishedAt: new Date().toISOString()
    }
  }

  if (isPageType(contentType)) {
    const data: Record<string, unknown> = {
      title: mdx.frontmatter.title,
      slug: mdx.slug,
      publishedAt: new Date().toISOString()
    }

    if (mdx.frontmatter.heroTitle || mdx.frontmatter.heroDescription) {
      data.hero = {
        title: mdx.frontmatter.heroTitle || mdx.frontmatter.title,
        description: mdx.frontmatter.heroDescription || ''
      }
    } else {
      const existingHero = getEntryField(existingEntry, 'hero')
      if (existingHero) {
        data.hero = existingHero
      }
    }

    const mdxBody = (mdx.content || '').trim()
    if (mdxBody.length > 0) {
      data.content = [
        {
          __component: 'blocks.paragraph',
          content: marked.parse(mdx.content)
        }
      ]
    } else {
      const existingContent = getEntryField(existingEntry, 'content')
      if (existingContent) {
        data.content = existingContent
      }
    }

    return data
  }

  return null
}

/** Sync a single English entry (create or update). Returns the entry if successful. */
async function syncEnglishEntry(
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
  return undefined
}

interface LocaleMatch {
  localeMdx: MDXFile
  matchScore: number
  matchReason: string
}

/** Find locale files that match an English entry. */
function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>,
  oldContentId: string | undefined
): LocaleMatch[] {
  const englishContentId =
    englishMdx.frontmatter.contentId ||
    englishMdx.frontmatter.postId ||
    englishMdx.slug

  const candidateLocales = localeFiles
    .filter((localeMdx) => {
      const localeCode = localeMdx.locale || 'en'
      const localeForPath = localeCode.split('-')[0]
      if (
        processedSlugs.has(localeForPath) &&
        processedSlugs.get(localeForPath)!.has(localeMdx.slug)
      ) {
        return false
      }
      return true
    })
    .map((localeMdx): LocaleMatch => {
      let matchScore = 0
      let matchReason = ''

      const localeContentId =
        localeMdx.frontmatter.contentId || localeMdx.frontmatter.postId

      if (localeContentId) {
        if (englishContentId && localeContentId === englishContentId) {
          matchScore = 1000
          matchReason = `contentId: ${englishContentId}`
        } else if (oldContentId && localeContentId === oldContentId) {
          matchScore = 1000
          matchReason = `contentId (old): ${oldContentId}`
        } else if (localeContentId === englishMdx.slug) {
          matchScore = 1000
          matchReason = `contentId matches slug: ${englishMdx.slug}`
        }
      }

      const localeLocalizes =
        localeMdx.localizes || localeMdx.frontmatter.localizes
      if (localeLocalizes === englishMdx.slug) {
        matchScore = Math.max(matchScore, 900)
        matchReason = matchReason || `localizes: ${englishMdx.slug}`
      }

      return { localeMdx, matchScore, matchReason }
    })
    .filter((candidate) => candidate.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)

  const localeMatches = new Map<string, LocaleMatch>()
  for (const candidate of candidateLocales) {
    const localeForPath = (candidate.localeMdx.locale || 'en').split('-')[0]
    if (!localeMatches.has(localeForPath)) {
      localeMatches.set(localeForPath, candidate)
    }
  }

  return Array.from(localeMatches.values())
}

/** Sync unmatched locale files by matching contentId to Strapi English entries. */
async function syncUnmatchedLocales(
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
    const localeContentId =
      localeMdx.frontmatter.contentId || localeMdx.frontmatter.postId

    const matchedEnglishEntry = localeContentId
      ? allStrapiEntries.find((entry) => entry.slug === localeContentId)
      : undefined

    if (matchedEnglishEntry) {
      console.log(
        `   ✅ Found match in Strapi: ${localeMdx.slug} (${localeCode}) -> ${matchedEnglishEntry.slug} (via contentId)`
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
      console.log(`      📋 Locale contentId: ${localeContentId || 'N/A'}`)
      if (localeContentId) {
        console.log(
          `      💡 Looking for English post in Strapi with slug: "${localeContentId}"`
        )
        console.log(
          `      💡 If it doesn't exist, create the English post first, then re-run sync`
        )
      } else {
        console.log(
          `      💡 Add 'contentId: "english-slug"' to frontmatter to link to English post`
        )
      }
    }
  }
}

/** Delete Strapi entries that no longer have a matching MDX file. */
async function deleteOrphanedEntries(
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

/** Sync a single locale (create or update localization). */
async function syncLocaleEntry(
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

async function syncContentType(
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

    const oldContentId = englishMdx.frontmatter.contentId as string | undefined

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
          processedSlugs,
          oldContentId
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

  for (const contentType of Object.keys(ctx.contentTypes) as Array<keyof ContentTypes>) {
    try {
      const results = await syncContentType(contentType, ctx)
      allResults.created += results.created
      allResults.updated += results.updated
      allResults.deleted += results.deleted
      allResults.errors += results.errors
    } catch (error) {
      console.error(`\n❌ Error syncing ${contentType}: ${(error as Error).message}`)
      allResults.errors++
    }
  }

  return allResults
}

export { buildEntryData, getEntryField, syncContentType }
