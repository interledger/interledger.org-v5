/**
 * Factory for page-like Strapi lifecycle hooks.
 * Handles i18n, dynamic zone content, hero/seo, MDX generation, and git sync.
 * Used by page and summit-page content types.
 */

import type { Core, UID, Modules } from '@strapi/strapi'
import { errors } from '@strapi/utils'
declare const strapi: Core.Strapi

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { serializeContent } from '../serializers/blocks'
import {
  LOCALES,
  defaultLang,
  heroFrontmatter,
  seoFrontmatter,
  getPreservedFields,
  uidToLogLabel,
  formatMdx,
  MATTER_STRINGIFY_OPTIONS,
  resolveFilenameSlug
} from './mdx'
import {
  deleteLocaleMdxFiles,
  removeLocalizesFromLocaleFiles
} from './localeMdxUtils'
import { toValidationError } from './contentValidation'
import { scheduleGitSync, getTargetRepoRoot, type SyncContext } from './gitSync'

export interface PageData {
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
    hero_call_to_action?: Array<{
      text?: string
      link?: string
      style?: 'primary' | 'secondary'
      external?: boolean
    }>
  }
  seo?: {
    metaDescription?: string
  }
  content?: Array<{ __component: string; [key: string]: unknown }>
  publishedAt?: string
  [key: string]: unknown
}

interface Event {
  result?: PageData
  state: { oldPathSlug?: string; locale?: string }
}

/**
 * Returns true when the request originates from the sync script.
 * The sync script sets `x-skip-mdx-export: true` so we don't re-write
 * MDX files that were the source of the import in the first place.
 *
 * strapi.requestContext uses AsyncLocalStorage — safe inside lifecycle hooks.
 */
export function shouldSkipMdxExport(): boolean {
  // Why: requestContext.get() throws when called outside an active request
  // (e.g. boot-time, background jobs). That's a "no context" state, not an
  // error — falling back to false is the right semantic.
  try {
    const ctx = strapi.requestContext.get()
    return ctx?.request?.headers?.['x-skip-mdx-export'] === 'true'
  } catch {
    return false
  }
}

export function getAdminAuthor(): { name: string; email: string } | undefined {
  // Why: same as shouldSkipMdxExport — requestContext.get() throws when there's
  // no active request. Returning undefined means "no author info available,"
  // which is a normal state rather than a failure.
  try {
    const ctx = strapi.requestContext.get()
    const user = ctx?.state?.user
    if (!user?.email) return undefined
    const name =
      [user.firstname, user.lastname].filter(Boolean).join(' ') || 'Strapi'
    return { name, email: user.email }
  } catch {
    return undefined
  }
}

export interface PageLifecycleConfig<
  T extends UID.ContentType = UID.ContentType
> {
  /** Strapi content type UID, e.g. 'api::foundation-page.foundation-page' */
  contentTypeUid: T
  /** English output path relative to project root, e.g. 'src/content/foundation-pages' */
  outputDir: string
  /** Strapi populate clause for fetching published content. */
  populate: Modules.Documents.Params.Populate.Any<T>
  /**
   * Optional MDX generation override. When provided, replaces the default
   * `generateMDX` which assumes hero/seo/content dynamic zone fields.
   * Receives the raw Strapi page data, preserved frontmatter fields from the
   * existing file, and the English slug for localized entries.
   *
   * We can remove this later if we standardize the hero/seo/content fields across all page content types.
   */
  generateMDX?: (
    page: PageData,
    preservedFields: Record<string, unknown>,
    englishSlug?: string
  ) => string
}

function normalizePathSlug(pathSlug: unknown): string {
  return pathSlug == null
    ? ''
    : String(pathSlug)
        .replace(/^\/+|\/+$/g, '')
        .trim()
}

/**
 * Resolves the MDX filepath for a page from `pathSlug` (full URL path, no leading slash).
 * Segments before the last `/` are directories; the last segment is the filename stem.
 *
 * English: grant/fellowship → {outputDir}/grant/fellowship.mdx
 * Spanish: grant/fellowship → {outputDir}/es/grant/fellowship.mdx
 * English: about-us         → {outputDir}/about-us.mdx
 */
export function resolvePageFilepath(
  outputDir: string,
  page: Pick<PageData, 'pathSlug'>,
  locale: string = defaultLang
): string {
  const normalized = normalizePathSlug(page.pathSlug)

  if (!normalized) {
    throw new Error('pathSlug is required')
  }
  const segments = normalized.split('/').filter(Boolean)
  const fileBase = segments[segments.length - 1]!
  const parentDirs = segments.slice(0, -1)
  if (locale !== defaultLang) {
    return path.join(outputDir, locale, ...parentDirs, `${fileBase}.mdx`)
  }
  return path.join(outputDir, ...parentDirs, `${fileBase}.mdx`)
}

function getOutputDir<T extends UID.ContentType>(
  config: PageLifecycleConfig<T>
): string {
  const projectRoot = getTargetRepoRoot()
  return path.join(projectRoot, config.outputDir)
}

export function generateMDX<T extends UID.ContentType = UID.ContentType>(
  _config: PageLifecycleConfig<T>,
  page: PageData,
  preservedFields: Record<string, unknown> = {},
  englishSlug?: string
): string {
  const locale = page.locale || defaultLang
  const isLocalized = locale !== defaultLang
  const { localizes, ...restPreserved } = preservedFields
  // Use englishSlug (current English slug) if provided, otherwise fall back to preserved localizes
  const localizesValue =
    (isLocalized && englishSlug ? englishSlug : undefined) || localizes

  let heroData: Record<string, unknown>
  try {
    heroData = heroFrontmatter(page.hero)
  } catch (error) {
    throw toValidationError(error)
  }
  const seoData = seoFrontmatter(page.seo)

  // Spread preserved fields first, then Strapi-managed fields overwrite
  const frontmatterData: Record<string, unknown> = {
    ...restPreserved,
    pathSlug: page.pathSlug,
    title: page.title,
    ...(page.pillar ? { pillar: page.pillar } : {}),
    ...heroData,
    ...seoData,
    ...(localizesValue ? { localizes: localizesValue } : {}),
    locale
  }

  // Explicitly remove Strapi-managed fields that are no longer set (e.g. deleted image)
  const heroManagedKeys = [
    'heroTitle',
    'heroDescription',
    'heroImage',
    'heroCtas'
  ] as const
  for (const key of heroManagedKeys) {
    if (!(key in heroData)) delete frontmatterData[key]
  }
  if (!('metaDescription' in seoData)) delete frontmatterData.metaDescription

  const content = serializeContent(page.content)

  return matter.stringify(
    content ? `\n${content}\n` : '',
    frontmatterData,
    MATTER_STRINGIFY_OPTIONS
  )
}

async function writeMDXFile<T extends UID.ContentType>(
  config: PageLifecycleConfig<T>,
  page: PageData,
  englishSlug?: string
): Promise<string | Error> {
  const locale = page.locale || defaultLang
  const outputDir = getOutputDir(config)
  const filepath = resolvePageFilepath(
    outputDir,
    { pathSlug: resolveFilenameSlug(locale, page.pathSlug ?? '', englishSlug) },
    locale
  )

  try {
    const fileDir = path.dirname(filepath)
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }

    // Preserve fields that exist in MDX but not in Strapi
    const preservedFields = getPreservedFields(filepath)
    const mdxContent = config.generateMDX
      ? config.generateMDX(page, preservedFields, englishSlug)
      : generateMDX(config, page, preservedFields, englishSlug)
    fs.writeFileSync(filepath, await formatMdx(mdxContent), 'utf-8')
    console.log(
      `✅ Generated ${uidToLogLabel(config.contentTypeUid)} MDX: ${filepath}`
    )

    return filepath
  } catch (error) {
    if (error instanceof errors.ValidationError) throw error
    return error instanceof Error
      ? new Error(
          `Failed to write ${uidToLogLabel(config.contentTypeUid)} MDX file ${filepath}: ${error.message}`,
          { cause: error }
        )
      : new Error(
          `Failed to write ${uidToLogLabel(config.contentTypeUid)} MDX file ${filepath}: ${String(error)}`
        )
  }
}

/**
 * Fetch a published document for the given documentId and locale.
 *
 * Returns:
 * - the page data on success
 * - `null` when no published version exists for that locale (a normal state)
 * - an `Error` when the Strapi document service throws (Strapi outage,
 *   misconfigured populate clause, etc.)
 *
 * Callers narrow the three states to distinguish "skip" from "fail."
 */
async function fetchPublished<T extends UID.ContentType>(
  config: PageLifecycleConfig<T>,
  documentId: string,
  locale: string
): Promise<PageData | null | Error> {
  try {
    const page = await strapi.documents(config.contentTypeUid).findOne({
      documentId,
      locale,
      status: 'published',
      populate: config.populate
    })
    return page as unknown as PageData | null
  } catch (error) {
    return error instanceof Error
      ? new Error(
          `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} ${documentId} (${locale}): ${error.message}`,
          { cause: error }
        )
      : new Error(
          `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} ${documentId} (${locale}): ${String(error)}`
        )
  }
}

async function exportAllLocales<T extends UID.ContentType>(
  config: PageLifecycleConfig<T>,
  documentId: string
): Promise<string[]> {
  const filepaths: string[] = []
  // Fetch English first so we can pass its slug to localized exports for the
  // `localizes` frontmatter link. If the fetch errors, we still attempt the
  // other locales; they'll just write without an English link.
  const englishResult = await fetchPublished(config, documentId, defaultLang)
  if (englishResult instanceof Error) {
    console.error(`⚠️  ${englishResult.message}`)
  }
  const englishPage = englishResult instanceof Error ? null : englishResult
  const englishSlug = englishPage?.pathSlug ?? undefined

  for (const locale of LOCALES) {
    const result =
      locale === defaultLang
        ? englishPage
        : await fetchPublished(config, documentId, locale)

    if (result instanceof Error) {
      console.error(`⚠️  ${result.message}`)
      continue
    }
    if (!result) {
      console.log(
        `⏭️  No published ${locale} ${uidToLogLabel(config.contentTypeUid)} for ${documentId}`
      )
      continue
    }

    const filepath = await writeMDXFile(config, result, englishSlug)
    if (filepath instanceof Error) {
      console.error(`⚠️  ${filepath.message}`)
      continue
    }
    filepaths.push(filepath)
  }

  return filepaths
}

/**
 * Strapi document service: `event.params.where` is the filter that selects
 * which row to update (often includes `locale` for i18n). Same “where” idea as
 * a query clause; the key name is Strapi’s, not ours.
 */
export type StrapiDocumentServiceUpdateWhere = Record<string, unknown>

/**
 * Read the active locale from a lifecycle `event.params` object.
 *
 * Strapi v5 puts `locale` in different places depending on who triggered the
 * request — you cannot assume a single shape. In practice:
 *
 * - **Document Service API** → `params.locale`
 * - **Bulk / plugin-style** flows → `params.data.locale`
 * - **Update filter** (document-service / DB-style) → `params.where.locale`
 *
 * This helper applies that precedence, then falls back to {@link defaultLang}
 * when the coalesced value is missing or empty (empty string on `params.locale`
 * still skips to `params.data.locale` / `params.where`, matching `??`).
 *
 * @see cms/docs/STRAPI_I18N_LOCALE.md
 */
export function readLocaleFromUpdateEvent(event: {
  params?: {
    locale?: string
    documentId?: string
    data?: { documentId?: string; locale?: string }
    where?: StrapiDocumentServiceUpdateWhere
  }
}): string {
  const p = event.params
  const localeFromWhere =
    typeof p?.where?.locale === 'string' ? p.where.locale : undefined

  const fromLocale = p?.locale
  const fromDataLocale = p?.data?.locale
  const combined = fromLocale ?? fromDataLocale ?? localeFromWhere
  const resolved =
    typeof combined === 'string' && combined.length > 0 ? combined : defaultLang

  let source:
    | 'params.locale'
    | 'params.data.locale'
    | 'params.where.locale'
    | 'default'
  if (!(typeof combined === 'string' && combined.length > 0)) {
    source = 'default'
  } else if (fromLocale != null && fromLocale === combined) {
    source = 'params.locale'
  } else if (
    fromDataLocale != null &&
    (fromLocale ?? fromDataLocale) === combined
  ) {
    source = 'params.data.locale'
  } else {
    source = 'params.where.locale'
  }

  console.debug('[pageLifecycle] readLocaleFromUpdateEvent', {
    source,
    resolved,
    'params.locale': fromLocale,
    'params.data.locale': fromDataLocale,
    'params.where.locale': localeFromWhere
  })

  return resolved
}

function deleteMdxIfExists(
  filepath: string,
  locale: string,
  label: string
): void {
  if (!fs.existsSync(filepath)) return
  // Why: a failed unlink during cleanup is logged but not surfaced — the
  // lifecycle hook continues to call scheduleGitSync. Returning Error here
  // would force every caller to handle a state that's only ever a stale
  // file we couldn't remove (filesystem permissions, in-flight reader),
  // which we'd just log and continue anyway.
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
export function createPageLifecycle<T extends UID.ContentType>(
  config: PageLifecycleConfig<T>
) {
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
      const ctx: SyncContext = {
        slug: result.pathSlug ?? undefined,
        action: 'create',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async beforeUpdate(event: {
      params?: {
        locale?: string
        documentId?: string
        data?: { documentId?: string; locale?: string; pathSlug?: string }
        where?: StrapiDocumentServiceUpdateWhere
      }
      state: { oldPathSlug?: string; locale?: string }
    }) {
      if (shouldSkipMdxExport()) return
      // Strapi v5: documentId is in params.data.documentId
      const documentId =
        event.params?.documentId ?? event.params?.data?.documentId
      if (!documentId) return

      const locale = readLocaleFromUpdateEvent(event)

      // Runs on every save (draft or publish). We only stash a prior slug when this
      // locale has a published version — export writes MDX from published data, so
      // a pathSlug change must remove the old file. Draft-only / never-published /
      // missing slug: no MDX path to reconcile, so skip.
      const existing = await fetchPublished(config, documentId, locale)
      if (existing instanceof Error) {
        console.error(`⚠️  ${existing.message}`)
        return
      }
      if (!existing?.pathSlug) return

      // Use Strapi’s published pathSlug only. Export always writes that value into
      // frontmatter and resolves the filepath from it, so disk should match; manual
      // MDX edits or a bad export are not special-cased here (avoids disk I/O every save).
      event.state.oldPathSlug = existing.pathSlug
      event.state.locale = locale
    },
    async afterUpdate(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      const label = uidToLogLabel(config.contentTypeUid)
      const locale = result.locale ?? defaultLang
      const { oldPathSlug } = event.state

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
      const ctx: SyncContext = {
        slug: result.pathSlug ?? undefined,
        action: 'update',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async afterDelete(event: Event) {
      const { result } = event
      if (!result) return
      if (shouldSkipMdxExport()) return

      const label = uidToLogLabel(config.contentTypeUid)

      const slug = normalizePathSlug(result.pathSlug)
      const author = getAdminAuthor()

      if (!slug) {
        console.warn(
          `[${label}] Skipping MDX delete: pathSlug missing on deleted document (documentId=${result.documentId})`
        )
        scheduleGitSync(label, { action: 'delete', author })
        return
      }

      console.log(`🗑️  Deleting ${label} MDX for all locales: ${slug}`)

      const outputDir = getOutputDir(config)
      removeLocalizesFromLocaleFiles(
        slug,
        (locale) => path.join(outputDir, locale),
        label
      )
      deleteLocaleMdxFiles(
        (locale) => resolvePageFilepath(outputDir, result, locale),
        label
      )

      scheduleGitSync(label, { slug, action: 'delete', author })
    }
  }
}
