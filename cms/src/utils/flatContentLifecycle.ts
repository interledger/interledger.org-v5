/**
 * Factory for flat (non-page) Strapi lifecycle hooks.
 * Handles MDX file writes, deletes, and git commits for content types
 * with flat frontmatter (no dynamic zones, no hero/SEO components).
 * Used by ambassador and similar non-page content types.
 */

import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport, getAdminAuthor } from './pageLifecycle'
import { LOCALES, defaultLang } from './mdx'
import {
  deleteLocaleMdxFiles,
  removeLocalizesFromLocaleFiles
} from './localeMdxUtils'
import { scheduleGitSync, type SyncContext } from './gitSync'

export interface FlatContentLifecycleConfig<
  T extends {
    pathSlug: string
    name?: string
    locale?: string
    publishedAt?: string
  }
> {
  /** Generates the full MDX file content string for the given entry. */
  generateContent: (entry: T) => string
  /** Returns the output directory for the given locale (undefined = English). */
  getBaseDir: (locale?: string) => string
  /** Label used in log messages and git commit messages, e.g. 'ambassador'. */
  label: string
}

// ── Flat locale MDX lifecycle (export all locales per save) ───────────────────

import type { StrapiGlobal } from './strapiTypes'

declare const strapi: StrapiGlobal

export interface FlatLocaleMdxLifecycleConfig<
  T extends {
    pathSlug: string
    name?: string
    locale?: string
    documentId?: string
    publishedAt?: string
  }
> {
  contentTypeUid: string
  label: string
  getBaseDir: (locale?: string) => string
  /** Receives entry and optional englishSlug for non-en locales (for localizes frontmatter). */
  generateContent: (entry: T, englishSlug?: string) => string
  populate?: Record<string, unknown>
}

/**
 * Creates lifecycle hooks for flat content types that export all locales per save.
 * Mirrors createPageLifecycle: fetches every locale from Strapi and writes all
 * locale MDX files in one pass, avoiding i18n "modified" badges on other locales.
 */
export function createFlatLocaleMdxLifecycle<
  T extends {
    pathSlug: string
    name?: string
    locale?: string
    documentId?: string
    publishedAt?: string
  }
>(config: FlatLocaleMdxLifecycleConfig<T>) {
  const {
    contentTypeUid,
    label,
    getBaseDir,
    generateContent,
    populate = {}
  } = config

  async function fetchPublished(
    documentId: string,
    locale: string
  ): Promise<T | null> {
    try {
      const result = await strapi.documents(contentTypeUid).findOne({
        documentId,
        locale,
        status: 'published',
        populate
      })
      return result as T | null
    } catch (error) {
      console.error(
        `Failed to fetch ${label} ${documentId} (${locale}):`,
        error
      )
      return null
    }
  }

  async function writeMdxFile(entry: T, englishSlug?: string): Promise<string> {
    const baseDir = getBaseDir(entry.locale)
    const filepath = path.join(baseDir, `${entry.pathSlug}.mdx`)
    await fs.promises.mkdir(baseDir, { recursive: true })
    await fs.promises.writeFile(
      filepath,
      generateContent(entry, englishSlug),
      'utf-8'
    )
    console.log(`✅ Generated ${label} MDX: ${filepath}`)
    return filepath
  }

  async function exportAllLocales(documentId: string): Promise<string[]> {
    const filepaths: string[] = []
    const englishEntry = await fetchPublished(documentId, defaultLang)
    const englishSlug = englishEntry?.pathSlug

    for (const locale of LOCALES) {
      try {
        const entry =
          locale === defaultLang
            ? englishEntry
            : await fetchPublished(documentId, locale)
        if (!entry) {
          console.log(`⏭️  No published ${locale} ${label} for ${documentId}`)
          continue
        }
        const filepath = await writeMdxFile(entry, englishSlug)
        filepaths.push(filepath)
      } catch (error) {
        console.error(
          `⚠️  Failed to export ${locale} ${label} for ${documentId}:`,
          error
        )
      }
    }
    return filepaths
  }

  function getFilePath(locale: string, pathSlug: string): string {
    return path.join(getBaseDir(locale), `${pathSlug}.mdx`)
  }

  return {
    async afterCreate(event: { result?: T }) {
      const { result } = event
      if (shouldSkipMdxExport()) return
      if (!result?.documentId || !result.publishedAt) return

      console.log(
        `📝 Creating ${label} MDX for all locales: ${result.pathSlug}`
      )
      await exportAllLocales(result.documentId)
      const ctx: SyncContext = {
        slug: result.pathSlug,
        action: 'create',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async afterUpdate(event: { result?: T }) {
      const { result } = event
      if (shouldSkipMdxExport()) return
      if (!result?.documentId || !result.publishedAt) return
      console.log(
        `📝 Updating ${label} MDX for all locales: ${result.pathSlug}`
      )
      await exportAllLocales(result.documentId)
      const ctx: SyncContext = {
        slug: result.pathSlug,
        action: 'update',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async afterDelete(event: { result?: T }) {
      const { result } = event
      if (shouldSkipMdxExport()) return
      if (!result?.documentId) return

      console.log(
        `🗑️  Deleting ${label} MDX for all locales: ${result.pathSlug}`
      )

      removeLocalizesFromLocaleFiles(
        result.pathSlug,
        (locale) => getBaseDir(locale),
        label
      )
      deleteLocaleMdxFiles(
        (locale) => getFilePath(locale, result.pathSlug),
        label
      )

      const ctx: SyncContext = {
        slug: result.pathSlug,
        action: 'delete',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    }
  }
}
