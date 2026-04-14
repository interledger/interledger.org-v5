/**
 * Factory for flat (non-page) Strapi lifecycle hooks.
 * Handles MDX file writes, deletes, and git commits for content types
 * with flat frontmatter (no dynamic zones, no hero/SEO components).
 * Used by ambassador and similar non-page content types.
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
  /** Label used in log messages and git commit messages, e.g. 'ambassador'. */
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
  const { contentTypeUid, label, getBaseDir, generateContent, populate } =
    config

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
    const slug = resolveFilenameSlug(
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
    async beforeUpdate(event: {
      params?: { documentId?: string; data?: { documentId?: string } }
      state: { oldEnglishSlug?: string }
    }) {
      if (shouldSkipMdxExport()) return
      const documentId =
        event.params?.documentId ?? event.params?.data?.documentId
      if (!documentId) return
      // Only the English slug drives filenames — stash it so afterUpdate can
      // detect renames and clean up the stale file for every locale.
      const existing = await fetchPublished(documentId, defaultLang)
      if (!existing?.pathSlug) return
      event.state.oldEnglishSlug = existing.pathSlug
    },
    async afterUpdate(event: {
      result?: T
      state: { oldEnglishSlug?: string }
    }) {
      const { result } = event
      if (shouldSkipMdxExport()) return
      if (!result?.documentId || !result.publishedAt) return

      const { oldEnglishSlug } = event.state
      if (
        oldEnglishSlug &&
        result.locale === defaultLang &&
        oldEnglishSlug !== result.pathSlug
      ) {
        console.log(
          `🗑️  ${label} slug changed from "${oldEnglishSlug}" to "${result.pathSlug}", deleting stale files`
        )
        deleteLocaleMdxFiles(
          (locale) => getFilePath(locale, oldEnglishSlug),
          label
        )
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
