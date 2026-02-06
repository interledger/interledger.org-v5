/**
 * Factory for page-like Strapi lifecycle hooks.
 * Handles i18n, dynamic zone content, hero/seo, MDX generation, and git sync.
 * Used by page and summit-page content types.
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from './gitSync'
import {
  type Hero,
  type Seo,
  type ContentBlock,
  LOCALES,
  escapeQuotes,
  serializeContent,
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
  hero?: Hero
  seo?: Seo
  content?: ContentBlock[]
  publishedAt?: string
  [key: string]: unknown
}

interface Event {
  result?: PageData
}

export interface PageLifecycleConfig {
  /** Strapi content type UID, e.g. 'api::page.page' */
  contentTypeUid: string
  /** English output path relative to project root, e.g. 'src/content/foundation-pages' */
  outputDir: string
  /** Directory name used inside src/content/{locale}/, e.g. 'foundation-pages' */
  localizedOutputDir: string
  /** Log prefix, e.g. 'page' or 'summit' */
  logPrefix: string
  /** Return extra frontmatter lines for content-type-specific fields */
  extraFrontmatter?: (page: PageData) => string[]
}

function getProjectRoot(): string {
  // cwd is cms/, go up one level to project root
  return path.resolve(process.cwd(), '..')
}

function getOutputDir(config: PageLifecycleConfig, locale: string): string {
  const projectRoot = getProjectRoot()

  if (locale === 'en') {
    return path.join(projectRoot, config.outputDir)
  }

  return path.join(projectRoot, 'src/content', locale, config.localizedOutputDir)
}

function generateMDX(
  config: PageLifecycleConfig,
  page: PageData,
  preservedFields: Record<string, string> = {}
): string {
  const locale = page.locale || 'en'
  const isLocalized = locale !== 'en'

  const frontmatterLines: string[] = [
    `slug: "${escapeQuotes(page.slug)}"`,
    `title: "${escapeQuotes(page.title)}"`,
    ...(config.extraFrontmatter?.(page) ?? []),
    ...heroFrontmatter(page.hero),
    ...seoFrontmatter(page.seo),
  ]

  // Always include contentId for locale linking (Strapi documentId)
  frontmatterLines.push(`contentId: "${page.documentId}"`)

  // Include preserved fields (like localizes) that exist in MDX but not in Strapi
  for (const [key, value] of Object.entries(preservedFields)) {
    frontmatterLines.push(`${key}: "${escapeQuotes(value)}"`)
  }

  if (isLocalized) {
    frontmatterLines.push(`locale: "${locale}"`)
  }

  const frontmatter = frontmatterLines.join('\n')
  const content = serializeContent(page.content)

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile(config: PageLifecycleConfig, page: PageData): Promise<string> {
  const locale = page.locale || 'en'
  const outputDir = getOutputDir(config, locale)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filepath = path.join(outputDir, `${page.slug}.mdx`)

  // Preserve fields that exist in MDX but not in Strapi
  const preservedFields = getPreservedFields(filepath)
  fs.writeFileSync(filepath, generateMDX(config, page, preservedFields), 'utf-8')
  console.log(`✅ Generated ${config.logPrefix} MDX: ${filepath}`)

  return filepath
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

async function exportAllLocales(config: PageLifecycleConfig, documentId: string): Promise<string[]> {
  const filepaths: string[] = []

  for (const locale of LOCALES) {
    try {
      const page = await fetchPublished(config, documentId, locale)
      if (!page) {
        console.log(`⏭️  No published ${locale} ${config.logPrefix} for ${documentId}`)
        continue
      }
      const filepath = await writeMDXFile(config, page)
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

      console.log(`📝 Creating ${config.logPrefix} MDX for all locales: ${result.slug}`)
      const filepaths = await exportAllLocales(config, result.documentId)

      if (filepaths.length > 0) {
        await gitCommitAndPush(filepaths, `${config.logPrefix}: add "${result.title}"`)
      }
    },

    async afterUpdate(event: Event) {
      const { result } = event
      if (!result) return

      console.log(`📝 Updating ${config.logPrefix} MDX for all locales: ${result.slug}`)
      const filepaths = await exportAllLocales(config, result.documentId)

      // Clean up MDX for any locale that is no longer published
      const deletedPaths: string[] = []
      for (const locale of LOCALES) {
        const outputDir = getOutputDir(config, locale)
        const filepath = path.join(outputDir, `${result.slug}.mdx`)
        if (!filepaths.includes(filepath) && fs.existsSync(filepath)) {
          fs.unlinkSync(filepath)
          console.log(`🗑️  Deleted unpublished ${locale} ${config.logPrefix} MDX: ${filepath}`)
          deletedPaths.push(filepath)
        }
      }

      const allPaths = [...filepaths, ...deletedPaths]
      if (allPaths.length > 0) {
        await gitCommitAndPush(allPaths, `${config.logPrefix}: update "${result.title}"`)
      }
    },

    async afterDelete(event: Event) {
      const { result } = event
      if (!result) return

      console.log(`🗑️  Deleting ${config.logPrefix} MDX for all locales: ${result.slug}`)

      const deletedPaths: string[] = []
      for (const locale of LOCALES) {
        const outputDir = getOutputDir(config, locale)
        const filepath = path.join(outputDir, `${result.slug}.mdx`)

        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath)
          console.log(`🗑️  Deleted ${locale} ${config.logPrefix} MDX: ${filepath}`)
          deletedPaths.push(filepath)
        }
      }

      if (deletedPaths.length > 0) {
        await gitCommitAndPush(deletedPaths, `${config.logPrefix}: delete "${result.title}"`)
      }
    }
  }
}
