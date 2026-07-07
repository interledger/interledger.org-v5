/**
 * Factory for flat (non-page) Strapi lifecycle hooks.
 * Handles MDX file writes, deletes, and git commits for content types
 * content types with flat frontmatter (hero/SEO are separate; profile biography
 * uses a paragraph-only dynamic zone exported as MDX body).
 * Used by profile-page and similar non-page content types.
 */

import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport, getAdminAuthor } from './pageLifecycle'
import { LOCALES, defaultLang, formatMdx, resolveFilenameSlug } from './mdx'
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
  /** Label used in log messages and git commit messages, e.g. 'profile-page'. */
  label: string
}

// ── Flat locale MDX lifecycle (export all locales per save) ───────────────────

import type { Core, UID, Modules } from '@strapi/strapi'

declare const strapi: Core.Strapi

export interface FlatLocaleMdxLifecycleConfig<
  T extends {
    pathSlug: string
    name?: string
    locale?: string
    documentId?: string
    publishedAt?: string
  },
  U extends UID.ContentType = UID.ContentType
> {
  contentTypeUid: U
  label: string
  getBaseDir: (locale?: string) => string
  /** Receives entry and optional englishSlug for non-en locales (for localizes frontmatter). */
  generateContent: (entry: T, englishSlug?: string) => string
  /** Maps pathSlug to a flat filename stem (no .mdx). Defaults to identity. */
  toMdxFilename?: (pathSlug: string) => string
  populate?: Modules.Documents.Params.Populate.Any<U>
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
  },
  U extends UID.ContentType = UID.ContentType
>(config: FlatLocaleMdxLifecycleConfig<T, U>) {
  const {
    contentTypeUid,
    label,
    getBaseDir,
    generateContent,
    populate,
    toMdxFilename = (pathSlug) => pathSlug
  } = config

  function resolveFileSlug(
    locale: string,
    pathSlug: string,
    englishSlug?: string
  ): string {
    return toMdxFilename(resolveFilenameSlug(locale, pathSlug, englishSlug))
  }

  async function fetchPublished(
    documentId: string,
    locale: string
  ): Promise<T | null> {
    try {
      const result = await strapi.documents(contentTypeUid).findOne({
        documentId,
        locale,
        status: 'published',
        ...(populate != null && { populate })
      })
      return result as unknown as T | null
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
    const slug = resolveFileSlug(
      entry.locale ?? defaultLang,
      entry.pathSlug,
      englishSlug
    )
    const filepath = path.join(baseDir, `${slug}.mdx`)
    await fs.promises.mkdir(baseDir, { recursive: true })
    await fs.promises.writeFile(
      filepath,
      await formatMdx(generateContent(entry, englishSlug)),
      'utf-8'
    )
    console.log(`✅ Generated ${label} MDX: ${filepath}`)
    return filepath
  }

  async function exportAllLocales(documentId: string): Promise<string[]> {
    const filepaths: string[] = []
    const englishEntry = await fetchPublished(documentId, 'en')
    const englishSlug = englishEntry?.pathSlug

    for (const locale of LOCALES) {
      try {
        const entry =
          locale === 'en'
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
    return path.join(getBaseDir(locale), `${toMdxFilename(pathSlug)}.mdx`)
  }

  function deleteMdxIfExists(filepath: string, locale: string): void {
    if (!fs.existsSync(filepath)) return
    try {
      fs.unlinkSync(filepath)
      console.log(`🗑️  Deleted old ${locale} ${label} MDX: ${filepath}`)
    } catch (error) {
      console.error(`Failed to delete ${label} MDX: ${filepath}`, error)
    }
  }

  /**
   * Delete old MDX files for all locales when EN slug changes.
   * All locale filenames use the EN slug (via resolveFilenameSlug).
   */
  function deleteOldFiles(oldEnSlug: string): void {
    for (const locale of LOCALES) {
      const filepath = getFilePath(locale, oldEnSlug)
      deleteMdxIfExists(filepath, locale)
    }
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
    async beforeUpdate(event: {
      params?: {
        locale?: string
        documentId?: string
        data?: { documentId?: string; locale?: string }
        where?: Record<string, unknown>
      }
      state: { oldPathSlug?: string }
    }) {
      if (shouldSkipMdxExport()) return
      const documentId =
        event.params?.documentId ?? event.params?.data?.documentId
      if (!documentId) return

      // Stash the EN slug — all locale filenames depend on it
      const enEntry = await fetchPublished(documentId, defaultLang)
      if (!enEntry?.pathSlug) return

      event.state.oldPathSlug = enEntry.pathSlug
    },
    async afterUpdate(event: { result?: T; state: { oldPathSlug?: string } }) {
      const { result } = event
      if (shouldSkipMdxExport()) return
      if (!result?.documentId || !result.publishedAt) return

      const { oldPathSlug } = event.state

      // Re-fetch EN to get the current slug
      const enEntry = await fetchPublished(result.documentId, defaultLang)
      const currentEnSlug = enEntry?.pathSlug

      if (oldPathSlug && currentEnSlug && oldPathSlug !== currentEnSlug) {
        console.log(
          `🗑️  ${label} pathSlug changed from "${oldPathSlug}" to "${currentEnSlug}", deleting old MDX files`
        )
        deleteOldFiles(oldPathSlug)
      }

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
