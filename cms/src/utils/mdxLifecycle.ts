/**
 * Factory for page-like Strapi lifecycle hooks.
 * Handles i18n, dynamic zone content, hero/seo, MDX generation, and git sync.
 * Used by page and summit-page content types.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { syncToGit } from './gitSync'
import { serializeContent } from '../serializers/blocks'
import {
  LOCALES,
  heroFrontmatter,
  seoFrontmatter,
  getPreservedFields,
} from './mdx'

interface PageData {
  id: number
  documentId: string
  title: string
  slug: string
  locale?: string
  hero?: { title?: string; description?: string; backgroundImage?: { url?: string } }
  seo?: { metaTitle?: string; metaDescription?: string; metaImage?: { url?: string }; keywords?: string; canonicalUrl?: string }
  content?: Array<{ __component: string; [key: string]: unknown }>
  publishedAt?: string
  [key: string]: unknown
}

interface Event {
  result?: PageData
}

export function shouldSkipMdxExport(): boolean {
  try {
    const ctx = strapi.requestContext.get() as { request?: { headers?: Record<string, string> } } | null
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
  /** Directory name used inside src/content/{locale}/, e.g. 'foundation-pages' */
  localizedOutputDir: string
  /** Log prefix, e.g. 'page' or 'summit' */
  logPrefix: string
  /** Return extra frontmatter fields for content-type-specific data */
  extraFrontmatter?: (page: PageData) => Record<string, unknown>
}

function getOutputDir(config: PageLifecycleConfig, locale: string): string {
  const projectRoot = path.resolve(process.cwd(), '..')

  if (locale === 'en') {
    return path.join(projectRoot, config.outputDir)
  }

  return path.join(projectRoot, 'src/content', locale, config.localizedOutputDir)
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
    slug: page.slug,
    title: page.title,
    ...(config.extraFrontmatter?.(page) ?? {}),
    ...heroFrontmatter(page.hero),
    ...seoFrontmatter(page.seo),
    contentId: page.documentId,
    ...(localizesValue ? { localizes: localizesValue } : {}),
    ...(isLocalized ? { locale } : {}),
  }

  const content = serializeContent(page.content)

  return matter.stringify(content ? `\n${content}\n` : '\n', frontmatterData)
}

async function writeMDXFile(
  config: PageLifecycleConfig,
  page: PageData,
  englishSlug?: string
): Promise<string> {
  const locale = page.locale || 'en'
  const outputDir = getOutputDir(config, locale)
  const filepath = path.join(outputDir, `${page.slug}.mdx`)

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Preserve fields that exist in MDX but not in Strapi
    const preservedFields = getPreservedFields(filepath)
    fs.writeFileSync(
      filepath,
      generateMDX(config, page, preservedFields, englishSlug),
      'utf-8'
    )
    console.log(`✅ Generated ${config.logPrefix} MDX: ${filepath}`)

    return filepath
  } catch (error) {
    console.error(`Failed to write ${config.logPrefix} MDX file: ${filepath}`, error)
    throw error
  }
}

async function fetchPublished(config: PageLifecycleConfig, documentId: string, locale: string): Promise<PageData | null> {
  try {
    const page = await strapi.documents(config.contentTypeUid as any).findOne({
      documentId,
      locale,
      status: 'published',
      populate: {
        hero: { populate: '*' },
        seo: { populate: '*' },
        content: { populate: '*' },
      }
    })
    return page as PageData | null
  } catch (error) {
    console.error(`Failed to fetch ${config.logPrefix} ${documentId} (${locale}):`, error)
    return null
  }
}

async function exportAllLocales(
  config: PageLifecycleConfig,
  documentId: string
): Promise<string[]> {
  const filepaths: string[] = []
  const englishPage = await fetchPublished(config, documentId, 'en')
  const englishSlug = englishPage?.slug

  for (const locale of LOCALES) {
    try {
      const page =
        locale === 'en'
          ? englishPage
          : await fetchPublished(config, documentId, locale)
      if (!page) {
        console.log(`⏭️  No published ${locale} ${config.logPrefix} for ${documentId}`)
        continue
      }
      const filepath = await writeMDXFile(config, page, englishSlug)
      filepaths.push(filepath)
    } catch (error) {
      console.error(`⚠️  Failed to export ${locale} ${config.logPrefix} for ${documentId}:`, error)
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

      console.log(`📝 Creating ${config.logPrefix} MDX for all locales: ${result.slug}`)
      const filepaths = await exportAllLocales(config, result.documentId)

      if (filepaths.length > 0) {
        await syncToGit(filepaths, `${config.logPrefix}: add "${result.title}"`)
      }
    },

    async afterUpdate(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      console.log(`📝 Updating ${config.logPrefix} MDX for all locales: ${result.slug}`)
      const filepaths = await exportAllLocales(config, result.documentId)

      // Clean up MDX for any locale that is no longer published
      const deletedPaths: string[] = []
      for (const locale of LOCALES) {
        const outputDir = getOutputDir(config, locale)
        const filepath = path.join(outputDir, `${result.slug}.mdx`)
        if (!filepaths.includes(filepath) && fs.existsSync(filepath)) {
          try {
            fs.unlinkSync(filepath)
            console.log(`🗑️  Deleted unpublished ${locale} ${config.logPrefix} MDX: ${filepath}`)
            deletedPaths.push(filepath)
          } catch (error) {
            console.error(`Failed to delete unpublished ${locale} ${config.logPrefix} MDX: ${filepath}`, error)
          }
        }
      }

      const allPaths = [...filepaths, ...deletedPaths]
      if (allPaths.length > 0) {
        await syncToGit(allPaths, `${config.logPrefix}: update "${result.title}"`)
      }
    },

    async afterDelete(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      console.log(`🗑️  Deleting ${config.logPrefix} MDX for all locales: ${result.slug}`)

      const deletedPaths: string[] = []
      for (const locale of LOCALES) {
        const outputDir = getOutputDir(config, locale)
        const filepath = path.join(outputDir, `${result.slug}.mdx`)

        if (fs.existsSync(filepath)) {
          try {
            fs.unlinkSync(filepath)
            console.log(`🗑️  Deleted ${locale} ${config.logPrefix} MDX: ${filepath}`)
            deletedPaths.push(filepath)
          } catch (error) {
            console.error(`Failed to delete ${locale} ${config.logPrefix} MDX: ${filepath}`, error)
          }
        }
      }

      if (deletedPaths.length > 0) {
        await syncToGit(deletedPaths, `${config.logPrefix}: delete "${result.title}"`)
      }
    }
  }
}
