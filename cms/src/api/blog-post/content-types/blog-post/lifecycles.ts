/**
 * Lifecycle callbacks for foundation blog-post.
 * Generates MDX files then commits and pushes to trigger Netlify preview builds.
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'
import {
  type MediaFile,
  escapeQuotes,
  getImageUrl,
  htmlToMarkdown,
  LOCALES,
  getPreservedFields
} from '../../../../utils/mdx'

interface BlogPost {
  id: number
  documentId: string
  title: string
  description: string
  slug: string
  date: string
  content: string
  featuredImage?: MediaFile
  lang?: string
  ogImageUrl?: string
  publishedAt?: string
  locale?: string
}

interface Event {
  result?: BlogPost
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toISOString().split('T')[0]
}

function generateFilename(post: BlogPost): string {
  const date = formatDate(post.date)
  const prefix = date ? `${date}-` : ''
  return `${prefix}${post.slug}.mdx`
}

function generateMDX(
  post: BlogPost,
  locale: string,
  preservedFields: Record<string, string> = {},
  englishSlug?: string
): string {
  const imageUrl = getImageUrl(post.featuredImage)
  const langValue = post.lang || locale
  const { localizes, ...restPreserved } = preservedFields
  const localizesValue =
    localizes || (locale !== 'en' && englishSlug ? englishSlug : undefined)

  const frontmatterLines = [
    `title: "${escapeQuotes(post.title)}"`,
    `description: "${escapeQuotes(post.description)}"`,
    post.ogImageUrl
      ? `ogImageUrl: "${escapeQuotes(post.ogImageUrl)}"`
      : undefined,
    `date: ${formatDate(post.date)}`,
    `slug: ${post.slug}`,
    `lang: "${escapeQuotes(langValue)}"`,
    imageUrl ? `image: "${escapeQuotes(imageUrl)}"` : undefined
  ].filter(Boolean) as string[]

  // Always include contentId for locale linking (Strapi documentId)
  frontmatterLines.push(`contentId: "${escapeQuotes(post.documentId)}"`)

  if (localizesValue) {
    frontmatterLines.push(`localizes: "${escapeQuotes(localizesValue)}"`)
  }

  // Include preserved fields (like localizes) that exist in MDX but not in Strapi
  for (const [key, value] of Object.entries(restPreserved)) {
    frontmatterLines.push(`${key}: "${escapeQuotes(value)}"`)
  }

  if (locale !== 'en') {
    frontmatterLines.push(`locale: "${escapeQuotes(locale)}"`)
  }

  const frontmatter = frontmatterLines.join('\n')
  const content = post.content ? htmlToMarkdown(post.content) : ''

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

function getOutputDir(locale: string): string {
  if (locale === 'en') {
    const outputPath = process.env.BLOG_MDX_OUTPUT_PATH || '../src/content/blog'
    return path.resolve(process.cwd(), outputPath)
  }

  return path.resolve(process.cwd(), `../src/content/${locale}/blog`)
}

async function writeMDXFile(
  post: BlogPost,
  locale: string,
  englishSlug?: string
): Promise<string> {
  const baseDir = getOutputDir(locale)

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  const filename = generateFilename(post)
  const filepath = path.join(baseDir, filename)

  // Preserve fields that exist in MDX but not in Strapi
  const preservedFields = getPreservedFields(filepath)
  fs.writeFileSync(
    filepath,
    generateMDX(post, locale, preservedFields, englishSlug),
    'utf-8'
  )
  console.log(`✅ Generated blog post MDX: ${filepath}`)
  return filepath
}

async function fetchPublishedPost(
  documentId: string,
  locale: string
): Promise<BlogPost | null> {
  try {
    const post = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId,
      locale,
      status: 'published',
      populate: {
        featuredImage: true
      }
    })
    return post as BlogPost | null
  } catch (error) {
    console.error(`Failed to fetch blog post ${documentId}:`, error)
    return null
  }
}

export default {
  async afterCreate(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`📝 Creating blog post MDX for all locales: ${result.slug}`)
    const filepaths: string[] = []
    const englishPost = await fetchPublishedPost(result.documentId, 'en')
    const englishSlug = englishPost?.slug

    for (const locale of LOCALES) {
      const post =
        locale === 'en'
          ? englishPost
          : await fetchPublishedPost(result.documentId, locale)
      if (!post) {
        console.log(`⏭️  No published ${locale} blog post for ${result.documentId}`)
        continue
      }
      const filepath = await writeMDXFile(post, locale, englishSlug)
      filepaths.push(filepath)
    }

    if (filepaths.length > 0) {
      await gitCommitAndPush(filepaths, `blog: add "${result.title}"`)
    }
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`📝 Updating blog post MDX for all locales: ${result.slug}`)
    const filepaths: string[] = []
    const deletedPaths: string[] = []
    const englishPost = await fetchPublishedPost(result.documentId, 'en')
    const englishSlug = englishPost?.slug

    for (const locale of LOCALES) {
      const post =
        locale === 'en'
          ? englishPost
          : await fetchPublishedPost(result.documentId, locale)
      if (post) {
        const filepath = await writeMDXFile(post, locale, englishSlug)
        filepaths.push(filepath)
      } else {
        const baseDir = getOutputDir(locale)
        const filepath = path.join(baseDir, generateFilename(result))
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath)
          console.log(`🗑️  Deleted unpublished ${locale} blog post MDX: ${filepath}`)
          deletedPaths.push(filepath)
        }
      }
    }

    const allPaths = [...filepaths, ...deletedPaths]
    if (allPaths.length > 0) {
      await gitCommitAndPush(allPaths, `blog: update "${result.title}"`)
    }
  },

  async afterDelete(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`🗑️  Deleting blog post MDX for all locales: ${result.slug}`)
    const deletedPaths: string[] = []

    for (const locale of LOCALES) {
      const baseDir = getOutputDir(locale)
      const filepath = path.join(baseDir, generateFilename(result))

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        console.log(`🗑️  Deleted ${locale} blog post MDX: ${filepath}`)
        deletedPaths.push(filepath)
      }
    }

    if (deletedPaths.length > 0) {
      await gitCommitAndPush(deletedPaths, `blog: delete "${result.title}"`)
    }
  }
}
