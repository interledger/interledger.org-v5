import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport, getAdminAuthor } from './pageLifecycle'
import { serializeContent } from '../serializers/blocks'
import { scheduleGitSync, getTargetRepoRoot, type SyncContext } from './gitSync'
import { BLOG_CONTENT_POPULATE } from './contentPopulate'
import { yamlSingleQuoteScalar, defaultLang } from '@/utils'
import type { StrapiGlobal } from './strapiTypes'

declare const strapi: StrapiGlobal

const BLOG_UID = 'api::foundation-blog-post.foundation-blog-post'

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
  content: ContentBlock[] | string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  locale: string
  pillar: 'vision' | 'mission' | 'tech' | 'values'
  featureImage?: {
    name: string
    alternativeText?: string
    url: string
  }
  thumbnailImage?: {
    name: string
    alternativeText?: string
    url: string
  }
  articleBio?: {
    author: string
    profileBio?: string
    profileImage?: { url: string; name: string }
  }[]
  tags?: { tagValue: string }[]
  localizations: { pathSlug: string }[]
}

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
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
        featureImage: true,
        thumbnailImage: true,
        articleBio: { populate: { profileImage: true } },
        tags: true,
        localizations: true,
        content: BLOG_CONTENT_POPULATE
      }
    })
    return post as BlogResult | null
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

function generateBlogMDX(post: BlogResult) {
  const yqs = yamlSingleQuoteScalar

  const articleBios =
    post.articleBio?.length > 0
      ? `articleBios:${post.articleBio
          .map((bio) => {
            const articleBio = [
              `\n  - author: ${yqs(bio.author)}`,
              bio.profileBio ? `\n    text: ${yqs(bio.profileBio)}` : null,
              bio.profileImage
                ? `\n    image: ${yqs(bio.profileImage.url)}`
                : null
            ]
              .filter(Boolean)
              .join('')
            return articleBio
          })
          .join('')}`
      : null

  const frontmatterLines = [
    `title: ${yqs(post.title)}`,
    `description: ${yqs(post.description)}`,
    `date: ${post.date}`,
    `pathSlug: ${post.pathSlug}`,
    `pillar: ${yqs(post.pillar)}`,
    post.featureImage?.url
      ? `featureImage: ${yqs(post.featureImage.url)}`
      : null,
    post.featureImage?.alternativeText
      ? `featureImageAlt: ${yqs(post.featureImage.alternativeText)}`
      : null,
    post.thumbnailImage?.url
      ? `thumbnailImage: ${yqs(post.thumbnailImage.url)}`
      : null,
    post.thumbnailImage?.alternativeText
      ? `thumbnailImageAlt: ${yqs(post.thumbnailImage.alternativeText)}`
      : null,
    articleBios,
    post.tags
      ? post.tags.length === 0
        ? `tags: []`
        : `tags:${post.tags.map((tag) => `\n  - ${yqs(tag.tagValue)}`).join('')}`
      : null,
    post.locale ? `locale: ${yqs(post.locale)}` : null,
    post.localizations?.[0]?.pathSlug
      ? `localizes: ${post.localizations[0].pathSlug}`
      : null
  ].filter(Boolean) as string[]

  const frontmatter = frontmatterLines.join('\n')
  const content = Array.isArray(post.content)
    ? serializeContent(post.content)
    : (post.content ?? '')

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile({
  outputPath,
  post
}: {
  outputPath: string
  post: BlogResult
}): Promise<string> {
  const filename = generateFilename({
    date: post.date,
    pathSlug: post.pathSlug
  })
  const filepath = path.join(outputPath, filename)
  const mdxContent = generateBlogMDX(post)

  await fs.promises.mkdir(outputPath, { recursive: true })
  await fs.promises.writeFile(filepath, mdxContent, 'utf-8')

  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
  return filepath
}

async function deleteMDXFile({
  outputPath,
  post
}: {
  outputPath: string
  post: BlogResult
}): Promise<string | null> {
  const filename = generateFilename({
    date: post.date,
    pathSlug: post.pathSlug
  })
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

  return {
    async afterCreate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      const label = event.model.singularName
      const post = await fetchBlogPost(result.documentId, result.locale)
      if (!post) return
      console.log(`📝 Creating ${label} MDX for: ${post.pathSlug}`)
      await writeMDXFile({ outputPath: getOutputPath(post.locale), post })
      const ctx: SyncContext = {
        slug: post.pathSlug,
        action: 'create',
        author: getAdminAuthor()
      }
      scheduleGitSync(label, ctx)
    },
    async afterUpdate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      const label = event.model.singularName
      const post = await fetchBlogPost(result.documentId, result.locale)
      if (!post) return
      console.log(`📝 Updating ${label} MDX for: ${post.pathSlug}`)
      await writeMDXFile({ outputPath: getOutputPath(post.locale), post })
      const ctx: SyncContext = {
        slug: post.pathSlug,
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
      console.log(`📝 Deleting ${label} MDX for: ${result.pathSlug}`)
      await deleteMDXFile({
        outputPath: getOutputPath(result.locale),
        post: result
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
