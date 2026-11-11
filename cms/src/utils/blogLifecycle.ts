import fs from 'fs'
import path from 'path'
import {
  shouldSkipMdxExport,
  getAdminAuthor,
  resolveUpdateTarget
} from './pageLifecycle'
import { serializeContent } from '../serializers/blocks'
import { scheduleGitSync, getTargetRepoRoot, type SyncContext } from './gitSync'
import {
  LOCALES,
  defaultLang,
  formatMdx,
  yamlSingleQuoteScalar,
  yamlLiteralBlockScalar,
  ckeditorFieldToParsedMarkdown
} from './mdx'
import { mdxSubpath } from './mdxFilenames'
import { generateBlurPlaceholder } from './imageBlurPlaceholder'
import { BLOG_CONTENT_POPULATE } from './contentPopulate'
import { toValidationError } from './contentValidation'
import { tryCatchAsync } from './tryCatch'
import type { AuthorBio } from './contentTypes'
import type { Core } from '@strapi/strapi'

declare const strapi: Core.Strapi

const BLOG_UID = 'api::foundation-blog-post.foundation-blog-post' as const

interface ContentBlock {
  __component: string
  [key: string]: unknown
}

interface BlogResult {
  id: number
  documentId: string
  title: string
  description: string
  pathSlug: string
  date: string
  lastUpdated?: string
  featured: boolean
  legacy?: boolean
  draft?: boolean | null
  content: ContentBlock[] | string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  locale: string
  featureMedia?: {
    image?: { name: string; url: string }
    alternativeText?: string | null
  }
  featureImageMobile?: {
    name: string
    alternativeText?: string | null
    url: string
  }
  thumbnailMedia?: {
    image?: { name: string; url: string }
    alternativeText?: string | null
  }
  articleBio?: AuthorBio[]
  categories?: { categoryValue: string }[]
  relatedArticles?: { slug: string }[]
  localizations: { pathSlug?: string; locale?: string }[]
}

/** MDX file path of each published locale of one post, keyed by locale. */
export type BlogFilepaths = Partial<Record<string, string>>

/** One read of a post's published locales, keyed by locale. */
type PublishedBlogLocales = Partial<Record<string, BlogResult>>

interface BlogUpdateState {
  /** Where each locale's file was before this update. */
  oldFilepaths?: BlogFilepaths
}

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
  state: BlogUpdateState
}

/**
 * Prefer the document's own locale when present; otherwise use the locale we
 * requested from Strapi. Document payloads sometimes omit `locale`, which used
 * to make ES exports drop both `locale: es` and `localizes`.
 *
 * When the document reports a locale that differs from the request (e.g. i18n
 * fell back to EN), trust the reported value — never overwrite it.
 */
export function stampBlogLocale(
  post: { locale?: string | null },
  requestedLocale: string
): string {
  const requested = requestedLocale.trim()
  const reported = post.locale?.trim()
  if (reported) {
    if (requested && reported !== requested) {
      console.warn(
        `⚠️  Blog fetch requested locale "${requested}" but document reports "${reported}"; trusting document locale`
      )
    }
    return reported
  }
  return requested || defaultLang
}

/**
 * Re-fetch blog post with full populate for dynamiczone content.
 * Lifecycle event.result doesn't populate dynamiczone `on` params —
 * same pattern as pageLifecycle.ts fetchPublished().
 */
async function fetchBlogPost(
  documentId: string,
  locale: string
): Promise<BlogResult | null | Error> {
  const post = await tryCatchAsync(() =>
    strapi.documents(BLOG_UID).findOne({
      documentId,
      locale,
      status: 'published',
      populate: {
        featureMedia: { populate: { image: true } },
        featureImageMobile: true,
        thumbnailMedia: { populate: { image: true } },
        articleBio: { populate: { media: { populate: { image: true } } } },
        categories: true,
        relatedArticles: true,
        localizations: true,
        content: BLOG_CONTENT_POPULATE
      }
    })
  )
  if (post instanceof Error) {
    return new Error(
      `Failed to fetch blog post ${documentId} (${locale}): ${post.message}`,
      { cause: post }
    )
  }
  if (!post) return null
  const stamped = post as unknown as BlogResult
  return {
    ...stamped,
    locale: stampBlogLocale(stamped, locale)
  }
}

/** For hooks that carry on without the post: log a failed read, then treat it as missing. */
function logFetchFailure(result: BlogResult | null | Error): BlogResult | null {
  if (!(result instanceof Error)) return result
  console.error(`⚠️  ${result.message}`)
  return null
}

/**
 * The error an update hook throws to stop a save. The hooks run inside the
 * save's transaction, so Strapi rolls the save back and the MDX files on disk
 * still match what is stored.
 */
function abortedSaveError(reason: string): Error {
  return toValidationError(
    new Error(`The blog post was not saved: ${reason}. Try again.`)
  )
}

/** Fields needed to resolve the English pathSlug used in blog filenames. */
export type BlogSlugSource = {
  pathSlug?: string | null
  localizations?: { pathSlug?: string; locale?: string }[] | null
}

/**
 * Resolve a real English pathSlug for a non-en blog export.
 * Prefer an explicit englishSlug (from an EN fetch), then the en localization
 * entry. Returns undefined when no EN counterpart is known — callers must not
 * invent one from the post's own pathSlug (that writes a false `localizes`
 * line and breaks sync-mdx / translationMap).
 *
 * Filenames still work without an EN slug: resolveFilenameSlug falls back to
 * the locale's own pathSlug when englishSlug is missing.
 */
export function resolveBlogEnglishSlug(
  post: BlogSlugSource,
  englishSlug?: string | null
): string | undefined {
  const fromArg = englishSlug?.trim()
  if (fromArg) return fromArg

  const localizations = post.localizations ?? []
  const enEntry = localizations.find(
    (entry) => (entry.locale || '').trim() === defaultLang
  )
  const fromEn = enEntry?.pathSlug?.trim()
  if (fromEn) return fromEn

  return undefined
}

/**
 * Filename used for blog MDX write and delete.
 * Non-default locales use the English pathSlug so paths stay locale-independent.
 */
export function resolveBlogMdxFilename(
  post: BlogSlugSource & { date?: string | null; locale?: string | null },
  englishSlug?: string | null
): string {
  return mdxSubpath('blog', {
    pathSlug: (post.pathSlug || '').trim(),
    locale: post.locale,
    englishSlug: resolveBlogEnglishSlug(post, englishSlug),
    date: post.date
  })
}

/**
 * The old files an update left behind: locales whose file path changed.
 * A locale missing from `after` is not reported; the update hook stops the
 * save for one instead.
 */
export function findMovedBlogFiles(
  before: BlogFilepaths,
  after: BlogFilepaths
): Array<{ locale: string; oldFilepath: string }> {
  const moved: Array<{ locale: string; oldFilepath: string }> = []
  for (const [locale, oldFilepath] of Object.entries(before)) {
    const newFilepath = after[locale]
    if (!oldFilepath || !newFilepath || newFilepath === oldFilepath) continue
    moved.push({ locale, oldFilepath })
  }
  return moved
}

/**
 * Generates a blur placeholder and logs (rather than throws) on failure — a
 * missing/unsupported source must never block publish, it just means that
 * image renders without a blur-up placeholder.
 */
async function tryGenerateBlurPlaceholder(
  url: string
): Promise<string | undefined> {
  const result = await generateBlurPlaceholder(url)
  if (result instanceof Error) {
    console.warn(`⚠️  Skipping blur placeholder for ${url}: ${result.message}`)
    return undefined
  }
  return result
}

export async function generateBlogMDX(
  post: BlogResult,
  options: { englishSlug?: string | null } = {}
): Promise<string> {
  const yqs = yamlSingleQuoteScalar
  const locale = (post.locale || defaultLang).trim() || defaultLang
  const isLocalized = locale !== defaultLang
  const englishSlug = isLocalized
    ? resolveBlogEnglishSlug(post, options.englishSlug)
    : undefined

  const featureImageBlur = post.featureMedia?.image?.url
    ? await tryGenerateBlurPlaceholder(post.featureMedia.image.url)
    : undefined
  const featureImageMobileBlur = post.featureImageMobile?.url
    ? await tryGenerateBlurPlaceholder(post.featureImageMobile.url)
    : undefined

  const articleBios =
    post.articleBio?.length > 0
      ? `articleBios:${post.articleBio
          .map((bio) => {
            if (!bio.author?.trim())
              throw new Error('Author Bio: Name is required')
            const articleBio = [
              `\n  - author: ${yqs(bio.author)}`,
              bio.link ? `\n    link: ${yqs(bio.link)}` : null,
              bio.profileBio
                ? `\n${yamlLiteralBlockScalar('text', ckeditorFieldToParsedMarkdown(bio.profileBio), 4)}`
                : null,
              bio.media?.image
                ? `\n    image: ${yqs(bio.media.image.url)}`
                : null,
              bio.media?.image
                ? `\n    imageAlt: ${yqs(bio.media.alternativeText ?? bio.author)}`
                : null
            ]
              .filter(Boolean)
              .join('')
            return articleBio
          })
          .join('')}`
      : null

  // Stable order matching existing blog MDX (locale/localizes before images).
  const frontmatterLines = [
    `title: ${yqs(post.title)}`,
    `description: ${yqs(post.description)}`,
    `date: ${post.date}`,
    post.lastUpdated ? `lastUpdated: ${post.lastUpdated}` : null,
    `pathSlug: ${post.pathSlug}`,
    post.draft === true ? `draft: true` : null,
    `featured: ${post.featured ?? false}`,
    // Always write locale so ES files never lose `locale: es` on re-export.
    // Bare scalars (not yqs) to match checked-in blog MDX and pathSlug above —
    // Prettier leaves YAML quoting alone, so quoting here would churn every save.
    `locale: ${locale}`,
    // Only when we resolved a real EN counterpart — never the ES pathSlug as
    // a stand-in (that advertises a non-existent EN route and confuses sync).
    isLocalized && englishSlug ? `localizes: ${englishSlug}` : null,
    post.featureMedia?.image?.url
      ? `featureImage: ${yqs(post.featureMedia.image.url)}`
      : null,
    post.featureMedia?.image?.url && post.featureMedia.alternativeText != null
      ? `featureImageAlt: ${yqs(post.featureMedia.alternativeText)}`
      : null,
    featureImageBlur ? `featureImageBlur: ${yqs(featureImageBlur)}` : null,
    post.featureImageMobile?.url
      ? `featureImageMobile: ${yqs(post.featureImageMobile.url)}`
      : null,
    post.featureImageMobile?.url &&
    post.featureImageMobile.alternativeText != null
      ? `featureImageMobileAlt: ${yqs(post.featureImageMobile.alternativeText)}`
      : null,
    featureImageMobileBlur
      ? `featureImageMobileBlur: ${yqs(featureImageMobileBlur)}`
      : null,
    post.thumbnailMedia?.image?.url
      ? `thumbnailImage: ${yqs(post.thumbnailMedia.image.url)}`
      : null,
    post.thumbnailMedia?.image?.url &&
    post.thumbnailMedia.alternativeText != null
      ? `thumbnailImageAlt: ${yqs(post.thumbnailMedia.alternativeText)}`
      : null,
    articleBios,
    post.categories
      ? post.categories.length === 0
        ? `categories: []`
        : `categories:${post.categories
            .filter((c) => c?.categoryValue)
            .map((c) => `\n  - ${yqs(c.categoryValue)}`)
            .join('')}`
      : null,
    post.relatedArticles?.length
      ? `relatedArticles:${post.relatedArticles
          .map((related) => {
            if (!related.slug)
              throw new Error('Related Articles: Slug is required')
            return `\n  - ${yqs(related.slug)}`
          })
          .join('')}`
      : null,
    post.legacy ? `legacy: true` : null
  ].filter(Boolean) as string[]

  const frontmatter = frontmatterLines.join('\n')
  const content = Array.isArray(post.content)
    ? serializeContent(post.content)
    : (post.content ?? '')

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

/**
 * Normalize empty locale for path + frontmatter only (does not override a real
 * reported locale). Write and delete share this so filenames stay aligned.
 */
function withNormalizedLocale(post: BlogResult): BlogResult {
  const locale = (post.locale || defaultLang).trim() || defaultLang
  return { ...post, locale }
}

async function writeMDXFile({
  outputPath,
  post,
  englishSlug
}: {
  outputPath: string
  post: BlogResult
  englishSlug?: string | null
}): Promise<string> {
  // Same path resolution as deleteMDXFile (resolveBlogMdxFilename + englishSlug).
  const normalized = withNormalizedLocale(post)
  const filename = resolveBlogMdxFilename(normalized, englishSlug)
  const filepath = path.join(outputPath, filename)
  const mdxContent = await generateBlogMDX(normalized, { englishSlug })

  await fs.promises.mkdir(outputPath, { recursive: true })
  await fs.promises.writeFile(filepath, await formatMdx(mdxContent), 'utf-8')

  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
  return filepath
}

async function deleteMDXFile({
  outputPath,
  post,
  englishSlug
}: {
  outputPath: string
  post: BlogResult
  englishSlug?: string | null
}): Promise<string | null> {
  // Same path resolution as writeMDXFile (resolveBlogMdxFilename + englishSlug).
  const normalized = withNormalizedLocale(post)
  const filename = resolveBlogMdxFilename(normalized, englishSlug)
  const filepath = path.join(outputPath, filename)

  try {
    await fs.promises.unlink(filepath)
    console.log(`🗑️  Deleted MDX file: ${filepath}`)
    return filepath
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(
        `❌ Failed to delete Blog Post MDX file: ${filepath}`,
        error
      )
      throw error
    }
    return null
  }
}

export function createBlogLifecycle({ outputDir }: { outputDir: string }) {
  const projectRoot = getTargetRepoRoot()
  const getOutputPath = (locale?: string) =>
    locale && locale !== defaultLang
      ? path.join(projectRoot, outputDir, locale)
      : path.join(projectRoot, outputDir)

  function deleteMdxIfExists(filepath: string, locale: string): void {
    if (!fs.existsSync(filepath)) return
    try {
      fs.unlinkSync(filepath)
      console.log(`🗑️  Deleted old ${locale} blog MDX: ${filepath}`)
    } catch (error) {
      console.error(`Failed to delete blog MDX: ${filepath}`, error)
    }
  }

  /**
   * One read of every published locale of a post, keyed by the locale each
   * document reports. An ES request answered with EN content lands under `en`,
   * so ES counts as unread rather than as a file that moved.
   */
  async function fetchPublishedBlogLocales(
    documentId: string
  ): Promise<PublishedBlogLocales | Error> {
    const posts: PublishedBlogLocales = {}
    for (const locale of LOCALES) {
      const post = await fetchBlogPost(documentId, locale)
      if (post instanceof Error) return post
      if (!post) continue
      const normalized = withNormalizedLocale(post)
      posts[normalized.locale] ??= normalized
    }
    return posts
  }

  /**
   * Where each post in `posts` is written, by the same rule as writeMDXFile.
   * Each locale's filename takes that locale's own date, so an ES date edit
   * moves the ES file even when nothing English changed.
   */
  function blogFilepathsOf(posts: PublishedBlogLocales): BlogFilepaths {
    const englishSlug = posts[defaultLang]?.pathSlug
    const filepaths: BlogFilepaths = {}
    for (const [locale, post] of Object.entries(posts)) {
      if (!post) continue
      filepaths[locale] = path.join(
        getOutputPath(post.locale),
        resolveBlogMdxFilename(post, englishSlug)
      )
    }
    return filepaths
  }

  async function writeBlogPost(
    post: BlogResult,
    englishSlug: string | undefined
  ): Promise<string> {
    try {
      return await writeMDXFile({
        outputPath: getOutputPath(post.locale),
        post,
        englishSlug
      })
    } catch (error) {
      console.error(
        `⚠️  Failed to export ${post.locale} blog post for ${post.documentId}:`,
        error
      )
      throw toValidationError(error)
    }
  }

  /**
   * Write every locale of a moved post. When one write fails, delete the
   * files this call created before rethrowing: the error rolls the save back,
   * and those new names would otherwise sit beside the old files as
   * duplicates.
   */
  async function writeMovedBlogLocales(
    posts: PublishedBlogLocales,
    englishSlug: string | undefined,
    oldFilepaths: BlogFilepaths
  ): Promise<void> {
    const existing = new Set(Object.values(oldFilepaths))
    const created: Array<{ locale: string; filepath: string }> = []
    try {
      for (const post of Object.values(posts)) {
        if (!post) continue
        const filepath = await writeBlogPost(post, englishSlug)
        if (!existing.has(filepath)) {
          created.push({ locale: post.locale, filepath })
        }
      }
    } catch (error) {
      for (const { locale, filepath } of created) {
        deleteMdxIfExists(filepath, locale)
      }
      throw error
    }
  }

  return {
    async afterCreate(event: BlogEvent) {
      const { result } = event
      if (!result || !result.publishedAt) return
      // Skip before any documents() fetch (sync-mdx sets this header).
      if (shouldSkipMdxExport()) return
      const requestedLocale = result.locale || defaultLang
      const post = logFetchFailure(
        await fetchBlogPost(result.documentId, requestedLocale)
      )
      if (!post) return
      const label = event.model.singularName
      console.log(`📝 Creating ${label} MDX for: ${post.pathSlug}`)
      const enPost =
        post.locale === defaultLang
          ? post
          : logFetchFailure(await fetchBlogPost(result.documentId, defaultLang))
      // Trust post.locale from fetchBlogPost (stamped only when omitted).
      await writeMDXFile({
        outputPath: getOutputPath(post.locale),
        post,
        englishSlug: enPost?.pathSlug
      })
      const ctx: SyncContext = {
        slug: post.pathSlug,
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
      state: BlogUpdateState
    }) {
      if (shouldSkipMdxExport()) return
      // Without every locale's current path, a rename cannot remove the old
      // files, so a failed read stops the save instead of leaving duplicates.
      const target = await resolveUpdateTarget(event, BLOG_UID)
      if (target instanceof Error) throw abortedSaveError(target.message)
      if (!target) return

      // Every locale, not just the one being saved: an EN slug or date edit
      // renames the ES file too.
      const posts = await fetchPublishedBlogLocales(target.documentId)
      if (posts instanceof Error) throw abortedSaveError(posts.message)
      event.state.oldFilepaths = blogFilepathsOf(posts)
    },
    async afterUpdate(event: BlogEvent) {
      const { result } = event
      if (!result || !result.publishedAt) return
      // Skip before any documents() fetch (sync-mdx sets this header).
      if (shouldSkipMdxExport()) return

      const label = event.model.singularName
      // Compare and write from the same read. A locale that existed before
      // the save and cannot be read now stops the save: skipping it would
      // keep its old file while the stored slug moved on, and nothing would
      // know that file's name any more.
      const posts = await fetchPublishedBlogLocales(result.documentId)
      if (posts instanceof Error) throw abortedSaveError(posts.message)
      const englishSlug = posts[defaultLang]?.pathSlug
      const newFilepaths = blogFilepathsOf(posts)
      const { oldFilepaths = {} } = event.state
      const unread = Object.keys(oldFilepaths).filter(
        (locale) => !newFilepaths[locale]
      )
      if (unread.length > 0) {
        throw abortedSaveError(
          `could not read the ${unread.join(', ')} version after saving`
        )
      }

      const moved = findMovedBlogFiles(oldFilepaths, newFilepaths)
      if (moved.length > 0) {
        console.log(`📝 Re-exporting all ${label} locales: ${englishSlug}`)
        await writeMovedBlogLocales(posts, englishSlug, oldFilepaths)
        for (const { locale, oldFilepath } of moved) {
          deleteMdxIfExists(oldFilepath, locale)
        }
      } else {
        const post = posts[result.locale || defaultLang]
        if (!post) return
        console.log(`📝 Updating ${label} MDX for: ${post.pathSlug}`)
        await writeBlogPost(post, englishSlug)
      }

      const ctx: SyncContext = {
        slug: result.pathSlug,
        action: 'update',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async afterDelete(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      const label = event.model.singularName
      // Lifecycle results often omit `locale` and never populate `localizations`.
      // Prefer the deleted document's locale; only fall back when fully omitted.
      // Resolve englishSlug via an EN fetch (not localizations[0]) so the
      // filename matches writeMDXFile / resolveBlogMdxFilename.
      const locale = stampBlogLocale(
        result,
        result.locale?.trim() || defaultLang
      )
      const enPost =
        locale === defaultLang
          ? null
          : logFetchFailure(await fetchBlogPost(result.documentId, defaultLang))
      const englishSlug =
        locale === defaultLang ? result.pathSlug : enPost?.pathSlug

      console.log(`📝 Deleting ${label} MDX for: ${result.pathSlug}`)
      await deleteMDXFile({
        outputPath: getOutputPath(locale),
        post: { ...result, locale },
        englishSlug
      })
      const ctx: SyncContext = {
        slug: result.pathSlug,
        action: 'delete',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    }
  }
}
