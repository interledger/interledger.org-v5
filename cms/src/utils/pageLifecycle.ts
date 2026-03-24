/**
 * Factory for page-like Strapi lifecycle hooks.
 * Handles i18n, dynamic zone content, hero/seo, MDX generation, and git sync.
 * Used by page and summit-page content types.
 */

// Strapi v5 Document API types
interface StrapiDocumentAPI {
  findOne: (options: {
    documentId: string
    locale: string
    status: string
    populate: Record<string, unknown>
  }) => Promise<unknown>
}

declare const strapi: {
  documents: (uid: string) => StrapiDocumentAPI
  requestContext: {
    get: () => { request?: { headers?: Record<string, string> } } | null
  }
}

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { serializeContent } from '../serializers/blocks'
import {
  LOCALES,
  heroFrontmatter,
  seoFrontmatter,
  getPreservedFields,
  uidToLogLabel,
  MATTER_STRINGIFY_OPTIONS
} from './mdx'
import {
  deleteLocaleMdxFiles,
  removeLocalizesFromLocaleFiles
} from './localeMdxUtils'
import { scheduleGitSync, getTargetRepoRoot } from './gitSync'

interface PageData {
  id: number
  documentId: string
  title: string
  /** May be null on afterDelete in some Strapi versions / payloads */
  pathSlug: string | null
  locale?: string
  hero?: {
    title?: string
    description?: string
    backgroundImage?: { url?: string }
  }
  seo?: {
    metaTitle?: string
    metaDescription?: string
    metaImage?: { url?: string }
    keywords?: string
    canonicalUrl?: string
  }
  content?: Array<{ __component: string; [key: string]: unknown }>
  publishedAt?: string
  [key: string]: unknown
}

interface Event {
  result?: PageData
}

/**
 * Returns true when the request originates from the sync script.
 * The sync script sets `x-skip-mdx-export: true` so we don't re-write
 * MDX files that were the source of the import in the first place.
 *
 * strapi.requestContext uses AsyncLocalStorage — safe inside lifecycle hooks.
 */
export function shouldSkipMdxExport(): boolean {
  try {
    const ctx = strapi.requestContext.get() as {
      request?: { headers?: Record<string, string> }
    } | null
    return ctx?.request?.headers?.['x-skip-mdx-export'] === 'true'
  } catch {
    return false
  }
}

export interface PageLifecycleConfig {
  /** Strapi content type UID, e.g. 'api::foundation-page.foundation-page' */
  contentTypeUid: string
  /** English output path relative to project root, e.g. 'src/content/foundation-pages' */
  outputDir: string
}

/**
 * Resolves the MDX filepath for a page from `pathSlug` (full URL path, no leading slash).
 * Segments before the last `/` are directories; the last segment is the filename stem.
 *
 * English: grant/ambassadors → {outputDir}/grant/ambassadors.mdx
 * Spanish: grant/ambassadors → {outputDir}/es/grant/ambassadors.mdx
 * English: about-us         → {outputDir}/about-us.mdx
 */
export function resolvePageFilepath(
  outputDir: string,
  page: Pick<PageData, 'pathSlug'>,
  locale: string = 'en'
): string {
  const normalized =
    page.pathSlug == null
      ? ''
      : String(page.pathSlug)
          .replace(/^\/+|\/+$/g, '')
          .trim()

  if (!normalized) {
    throw new Error('pathSlug is required')
  }
  const segments = normalized.split('/').filter(Boolean)
  const fileBase = segments[segments.length - 1]!
  const parentDirs = segments.slice(0, -1)
  if (locale !== 'en') {
    return path.join(outputDir, locale, ...parentDirs, `${fileBase}.mdx`)
  }
  return path.join(outputDir, ...parentDirs, `${fileBase}.mdx`)
}

function getOutputDir(config: PageLifecycleConfig): string {
  const projectRoot = getTargetRepoRoot()
  return path.join(projectRoot, config.outputDir)
}

function generateMDX(
  config: PageLifecycleConfig,
  page: PageData,
  preservedFields: Record<string, unknown> = {},
  englishSlug?: string
): string {
  const locale = page.locale || 'en'
  const isLocalized = locale !== 'en'
  const { localizes, ...restPreserved } = preservedFields
  // Use englishSlug (current English slug) if provided, otherwise fall back to preserved localizes
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) || localizes

  // Spread preserved fields first, then Strapi-managed fields overwrite
  const frontmatterData: Record<string, unknown> = {
    ...restPreserved,
    pathSlug: page.pathSlug,
    title: page.title,
    ...(page.pillar ? { pillar: page.pillar } : {}),
    ...heroFrontmatter(page.hero),
    ...seoFrontmatter(page.seo),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  const content = serializeContent(page.content)

  return matter.stringify(
    content ? `\n${content}\n` : '',
    frontmatterData,
    MATTER_STRINGIFY_OPTIONS
  )
}

async function writeMDXFile(
  config: PageLifecycleConfig,
  page: PageData,
  englishSlug?: string
): Promise<string> {
  const locale = page.locale || 'en'
  const outputDir = getOutputDir(config)
  const filepath = resolvePageFilepath(outputDir, page, locale)

  try {
    const fileDir = path.dirname(filepath)
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }

    // Preserve fields that exist in MDX but not in Strapi
    const preservedFields = getPreservedFields(filepath)
    fs.writeFileSync(
      filepath,
      generateMDX(config, page, preservedFields, englishSlug),
      'utf-8'
    )
    console.log(
      `✅ Generated ${uidToLogLabel(config.contentTypeUid)} MDX: ${filepath}`
    )

    return filepath
  } catch (error) {
    console.error(
      `Failed to write ${uidToLogLabel(config.contentTypeUid)} MDX file: ${filepath}`,
      error
    )
    throw error
  }
}

async function fetchPublished(
  config: PageLifecycleConfig,
  documentId: string,
  locale: string
): Promise<PageData | null> {
  try {
    const page = await strapi.documents(config.contentTypeUid).findOne({
      documentId,
      locale,
      status: 'published',
      populate: {
        hero: { populate: '*' },
        seo: { populate: '*' },
        content: {
          on: {
            'blocks.paragraph': {},
            'blocks.callout-text': {},
            'blocks.blockquote': {},
            'blocks.cards-grid': {},
            'blocks.card-links-grid': {},
            'blocks.carousel': {},
            'blocks.cta-banner': {},
            'blocks.ambassador': {
              populate: { ambassador: { populate: { photo: true } } }
            },
            'blocks.ambassadors-grid': {
              populate: { ambassadors: true }
            },
            'blocks.pdf-embed': {
              populate: { file: true }
            }
          }
        }
      }
    })
    return page as PageData | null
  } catch (error) {
    console.error(
      `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} ${documentId} (${locale}):`,
      error
    )
    return null
  }
}

async function exportAllLocales(
  config: PageLifecycleConfig,
  documentId: string
): Promise<string[]> {
  const filepaths: string[] = []
  const englishPage = await fetchPublished(config, documentId, 'en')
  const englishSlug = englishPage?.pathSlug

  for (const locale of LOCALES) {
    try {
      const page =
        locale === 'en'
          ? englishPage
          : await fetchPublished(config, documentId, locale)
      if (!page) {
        console.log(
          `⏭️  No published ${locale} ${uidToLogLabel(config.contentTypeUid)} for ${documentId}`
        )
        continue
      }
      const filepath = await writeMDXFile(config, page, englishSlug)
      filepaths.push(filepath)
    } catch (error) {
      console.error(
        `⚠️  Failed to export ${locale} ${uidToLogLabel(config.contentTypeUid)} for ${documentId}:`,
        error
      )
    }
  }

  return filepaths
}

/** Cache old pathSlug before update so we can delete old files if it changes (per locale). */
const pendingPathSlugChanges = new Map<string, string>()

function pendingPathSlugKey(documentId: string, locale: string): string {
  return `${documentId}:${locale}`
}

/** Exported for unit tests — Strapi passes locale on localized document updates. */
export function readLocaleFromUpdateEvent(event: {
  params?: {
    locale?: string
    documentId?: string
    data?: { documentId?: string; locale?: string }
    where?: Record<string, unknown>
  }
}): string {
  const whereLocale = event.params?.where?.locale
  const locale =
    event.params?.locale ??
    event.params?.data?.locale ??
    (typeof whereLocale === 'string' ? whereLocale : undefined)
  return typeof locale === 'string' && locale.length > 0 ? locale : 'en'
}

function deleteMdxIfExists(
  filepath: string,
  locale: string,
  label: string
): void {
  if (!fs.existsSync(filepath)) return
  try {
    fs.unlinkSync(filepath)
    console.log(`🗑️  Deleted ${locale} ${label} MDX: ${filepath}`)
  } catch (error) {
    console.error(`Failed to delete ${locale} ${label} MDX: ${filepath}`, error)
  }
}

/**
 * Creates Strapi lifecycle hooks for a page-like content type with i18n and dynamic zones.
 */
export function createPageLifecycle(config: PageLifecycleConfig) {
  return {
    async afterCreate(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      const label = uidToLogLabel(config.contentTypeUid)
      console.log(
        `📝 Creating ${label} MDX for all locales: ${result.pathSlug}`
      )
      await exportAllLocales(config, result.documentId)
      scheduleGitSync(label)
    },
    async beforeUpdate(event: {
      params?: {
        locale?: string
        documentId?: string
        data?: { documentId?: string; locale?: string; pathSlug?: string }
      }
    }) {
      if (shouldSkipMdxExport()) return
      // Strapi v5: documentId is in params.data.documentId
      const documentId =
        event.params?.documentId ?? event.params?.data?.documentId
      if (!documentId) return

      const locale = readLocaleFromUpdateEvent(event)

      // Per-locale pathSlug: only the updated locale's file moves. Using English
      // here caused Spanish-only slug edits to stash the EN slug, so we deleted
      // the wrong paths and left stale es/.../page.mdx files on every rename.
      const existing = await fetchPublished(config, documentId, locale)
      if (!existing?.pathSlug) return

      const outputDir = getOutputDir(config)
      const currentFilepath = resolvePageFilepath(outputDir, existing, locale)
      let oldSlug = existing.pathSlug
      if (fs.existsSync(currentFilepath)) {
        const content = fs.readFileSync(currentFilepath, 'utf-8')
        const { data } = matter(content)
        if (data.pathSlug && typeof data.pathSlug === 'string') {
          oldSlug = data.pathSlug
        }
      }
      pendingPathSlugChanges.set(
        pendingPathSlugKey(documentId, locale),
        oldSlug
      )
    },
    async afterUpdate(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      const label = uidToLogLabel(config.contentTypeUid)
      const locale = result.locale ?? 'en'
      const pendingKey = pendingPathSlugKey(result.documentId, locale)
      const oldPathSlug = pendingPathSlugChanges.get(pendingKey)
      pendingPathSlugChanges.delete(pendingKey)

      // If this locale's pathSlug changed, remove only that locale's old file
      if (oldPathSlug && oldPathSlug !== result.pathSlug) {
        console.log(
          `🗑️  PathSlug changed (${locale}) from "${oldPathSlug}" to "${result.pathSlug}", deleting old MDX file`
        )
        const outputDir = getOutputDir(config)
        const oldPage = { pathSlug: oldPathSlug }
        const oldFilepath = resolvePageFilepath(outputDir, oldPage, locale)
        deleteMdxIfExists(oldFilepath, locale, label)
      }

      console.log(
        `📝 Updating ${label} MDX for all locales: ${result.pathSlug}`
      )
      await exportAllLocales(config, result.documentId)
      scheduleGitSync(label)
    },
    async afterDelete(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      const label = uidToLogLabel(config.contentTypeUid)

      const slug =
        result.pathSlug == null
          ? ''
          : String(result.pathSlug)
              .replace(/^\/+|\/+$/g, '')
              .trim()
      if (!slug) {
        strapi.log.warn(
          `[${label}] Skipping MDX delete: pathSlug missing on deleted document (documentId=${result.documentId})`
        )
        scheduleGitSync(label)
        return
      }

      console.log(`🗑️  Deleting ${label} MDX for all locales: ${slug}`)

      const outputDir = getOutputDir(config)
      removeLocalizesFromLocaleFiles(slug, () => outputDir, label)
      deleteLocaleMdxFiles(
        (locale) => resolvePageFilepath(outputDir, result, locale),
        label
      )

      scheduleGitSync(label)
    }
  }
}
