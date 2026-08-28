import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport, getAdminAuthor } from './pageLifecycle'
import { serializeContent } from '../serializers/blocks'
import { scheduleGitSync, getTargetRepoRoot, type SyncContext } from './gitSync'
import {
  LOCALES,
  defaultLang,
  formatMdx,
  yamlSingleQuoteScalar,
  yamlLiteralBlockScalar,
  resolveFilenameSlug,
  ckeditorFieldToParsedMarkdown
} from './mdx'
import { BLOG_CONTENT_POPULATE } from './contentPopulate'
import { toValidationError } from './contentValidation'
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

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
  state: { oldPathSlug?: string; oldDate?: string }
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
): Promise<BlogResult | null> {
  try {
    const post = await strapi.documents(BLOG_UID).findOne({
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
    if (!post) return null
    const stamped = post as unknown as BlogResult
    return {
      ...stamped,
      locale: stampBlogLocale(stamped, locale)
    }
  } catch (error) {
    console.error(`Failed to fetch blog post ${documentId} (${locale}):`, error)
    return null
  }
}

function generateFilename({
  date,
  pathSlug
}: {
  date: string
  pathSlug: string
}): string {
  const prefix = date ? `${date}-` : ''
  return `${prefix}${pathSlug}.mdx`
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
  const locale = (post.locale || defaultLang).trim() || defaultLang
  const resolvedEnglishSlug = resolveBlogEnglishSlug(post, englishSlug)
  return generateFilename({
    date: post.date ?? '',
    pathSlug: resolveFilenameSlug(
      locale,
      (post.pathSlug || '').trim(),
      resolvedEnglishSlug
    )
  })
}

export function generateBlogMDX(
  post: BlogResult,
  options: { englishSlug?: string | null } = {}
) {
  const yqs = yamlSingleQuoteScalar
  const locale = (post.locale || defaultLang).trim() || defaultLang
  const isLocalized = locale !== defaultLang
  const englishSlug = isLocalized
    ? resolveBlogEnglishSlug(post, options.englishSlug)
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
    post.featureImageMobile?.url
      ? `featureImageMobile: ${yqs(post.featureImageMobile.url)}`
      : null,
    post.featureImageMobile?.url &&
    post.featureImageMobile.alternativeText != null
      ? `featureImageMobileAlt: ${yqs(post.featureImageMobile.alternativeText)}`
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
  const mdxContent = generateBlogMDX(normalized, { englishSlug })

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
   * Delete old blog MDX files for all locales when EN slug changes.
   * Blog filenames include the date: `{date}-{slug}.mdx` where slug is the
   * english slug for all locales (via resolveFilenameSlug).
   */
  function deleteOldBlogFiles(oldEnSlug: string, oldDate: string): void {
    for (const locale of LOCALES) {
      const filename = generateFilename({ date: oldDate, pathSlug: oldEnSlug })
      const filepath = path.join(getOutputPath(locale), filename)
      deleteMdxIfExists(filepath, locale)
    }
  }

  /** Export all locale variants for a blog post (mirrors pageLifecycle pattern). */
  async function exportAllBlogLocales(documentId: string): Promise<string[]> {
    const filepaths: string[] = []
    const enPost = await fetchBlogPost(documentId, defaultLang)
    const englishSlug = enPost?.pathSlug

    for (const locale of LOCALES) {
      const post =
        locale === defaultLang
          ? enPost
          : await fetchBlogPost(documentId, locale)
      if (!post) {
        console.log(`⏭️  No published ${locale} blog post for ${documentId}`)
        continue
      }
      try {
        // Trust post.locale from fetchBlogPost (stamped only when omitted).
        const filepath = await writeMDXFile({
          outputPath: getOutputPath(post.locale),
          post,
          englishSlug
        })
        filepaths.push(filepath)
      } catch (error) {
        console.error(
          `⚠️  Failed to export ${locale} blog post for ${documentId}:`,
          error
        )
        throw toValidationError(error)
      }
    }
    return filepaths
  }

  return {
    async afterCreate(event: BlogEvent) {
      const { result } = event
      if (!result || !result.publishedAt) return
      // Skip before any documents() fetch (sync-mdx sets this header).
      if (shouldSkipMdxExport()) return
      const requestedLocale = result.locale || defaultLang
      const post = await fetchBlogPost(result.documentId, requestedLocale)
      if (!post) return
      const label = event.model.singularName
      console.log(`📝 Creating ${label} MDX for: ${post.pathSlug}`)
      const enPost =
        post.locale === defaultLang
          ? post
          : await fetchBlogPost(result.documentId, defaultLang)
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
      }
      state: { oldPathSlug?: string; oldDate?: string }
    }) {
      if (shouldSkipMdxExport()) return
      const documentId =
        event.params?.documentId ?? event.params?.data?.documentId
      if (!documentId) return

      // Always stash the EN slug/date — all locale filenames depend on it
      const enPost = await fetchBlogPost(documentId, defaultLang)
      if (!enPost?.pathSlug) return

      event.state.oldPathSlug = enPost.pathSlug
      event.state.oldDate = enPost.date
    },
    async afterUpdate(event: BlogEvent) {
      const { result } = event
      if (!result || !result.publishedAt) return
      // Skip before any documents() fetch (sync-mdx sets this header).
      if (shouldSkipMdxExport()) return

      const requestedLocale = result.locale || defaultLang
      const currentLocalePost = await fetchBlogPost(
        result.documentId,
        requestedLocale
      )

      const label = event.model.singularName
      const { oldPathSlug, oldDate } = event.state
      const enPost = await fetchBlogPost(result.documentId, defaultLang)
      const currentEnSlug = enPost?.pathSlug
      const currentDate = enPost?.date

      // If the EN slug or the date changed, delete old files for all locales and re-export
      if (
        oldPathSlug &&
        oldDate &&
        currentEnSlug &&
        currentDate &&
        (oldPathSlug !== currentEnSlug || oldDate !== currentDate)
      ) {
        console.log(
          `🗑️  Blog pathSlug/date changed from "${oldPathSlug}"/"${oldDate}" to "${currentEnSlug}"/"${currentDate}", deleting old MDX files`
        )
        deleteOldBlogFiles(oldPathSlug, oldDate)
        console.log(`📝 Re-exporting all ${label} locales: ${currentEnSlug}`)
        await exportAllBlogLocales(result.documentId)
      } else {
        const post = currentLocalePost
        if (!post) return
        console.log(`📝 Updating ${label} MDX for: ${post.pathSlug}`)
        try {
          // Trust post.locale from fetchBlogPost (stamped only when omitted).
          await writeMDXFile({
            outputPath: getOutputPath(post.locale),
            post,
            englishSlug: enPost?.pathSlug
          })
        } catch (error) {
          throw toValidationError(error)
        }
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
          : await fetchBlogPost(result.documentId, defaultLang)
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
