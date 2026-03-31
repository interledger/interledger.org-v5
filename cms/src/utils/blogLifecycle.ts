import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport } from './pageLifecycle'
import { serializeContent } from '../serializers/blocks'
import { scheduleGitSync, getTargetRepoRoot } from './gitSync'
import { BLOG_CONTENT_POPULATE } from './contentPopulate'
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

function yamlSingleQuote(value: string): string {
  return `${value.replace(/'/g, '’').replace(/\r\n/g, '\n')}`
}
const q = yamlSingleQuote

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
  const articleBios =
    post.articleBio?.length > 0
      ? `articleBios:${post.articleBio
          .map((bio) => {
            const articleBio = [
              `\n  - author: ${q(bio.author)}`,
              bio.profileBio ? `\n    text: '${q(bio.profileBio)}'` : null,
              bio.profileImage
                ? `\n    image: '${q(bio.profileImage.url)}'`
                : null
            ]
              .filter(Boolean)
              .join('')
            return articleBio
          })
          .join('')}`
      : null

  const frontmatterLines = [
    `title: '${q(post.title)}'`,
    `description: '${q(post.description)}'`,
    `date: ${post.date}`,
    `pathSlug: ${post.pathSlug}`,
    `pillar: '${q(post.pillar)}'`,
    post.featureImage?.url
      ? `featureImage: '${q(post.featureImage.url)}'`
      : null,
    post.featureImage?.alternativeText
      ? `featureImageAlt: '${q(post.featureImage.alternativeText)}'`
      : null,
    post.thumbnailImage?.url
      ? `thumbnailImage: '${q(post.thumbnailImage.url)}'`
      : null,
    post.thumbnailImage?.alternativeText
      ? `thumbnailImageAlt: '${q(post.thumbnailImage.alternativeText)}'`
      : null,
    articleBios,
    post.tags
      ? post.tags.length === 0
        ? `tags: []`
        : `tags:${post.tags.map((tag) => `\n  - ${q(tag.tagValue)}`).join('')}`
      : null,
    post.locale ? `locale: ${q(post.locale)}` : null,
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
    locale && locale !== 'en'
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
      scheduleGitSync(label)
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
      scheduleGitSync(label)
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
      scheduleGitSync(label)
    }
  }
}
