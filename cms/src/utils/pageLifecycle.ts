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
  path?: string
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
 * Legacy: if `path` is set (old Strapi), uses {outputDir}/{path}/{locale?}/{pathSlug}.mdx.
 *
 * English: grant/ambassadors → {outputDir}/grant/ambassadors.mdx
 * Spanish: grant/ambassadors → {outputDir}/es/grant/ambassadors.mdx
 * English: about-us         → {outputDir}/about-us.mdx
 */
export function resolvePageFilepath(
  outputDir: string,
  page: Pick<PageData, 'pathSlug' | 'path'>,
  locale: string = 'en'
): string {
  const normalized =
    page.pathSlug == null
      ? ''
      : String(page.pathSlug)
          .replace(/^\/+|\/+$/g, '')
          .trim()

  const legacyPrefix = (page.path ?? '').replace(/^\/+|\/+$/g, '').trim()
  if (legacyPrefix) {
    const localeSuffix = locale !== 'en' ? locale : ''
    if (!normalized) {
      throw new Error('pathSlug is required when legacy path is set')
    }
    return path.join(outputDir, legacyPrefix, localeSuffix, `${normalized}.mdx`)
  }

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
  delete restPreserved.path
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
    async afterUpdate(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return
      const label = uidToLogLabel(config.contentTypeUid)
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
