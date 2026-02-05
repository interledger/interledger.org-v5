/**
 * Lifecycle callbacks for foundation blog-post.
 * Generates MDX files then commits and pushes to trigger Netlify preview builds.
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'
import { type MediaFile, escapeQuotes, getImageUrl, htmlToMarkdown } from '../../../../utils/mdx'

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

function generateMDX(post: BlogPost): string {
  const imageUrl = getImageUrl(post.featuredImage)

  const frontmatterLines = [
    `title: "${escapeQuotes(post.title)}"`,
    `description: "${escapeQuotes(post.description)}"`,
    post.ogImageUrl
      ? `ogImageUrl: "${escapeQuotes(post.ogImageUrl)}"`
      : undefined,
    `date: ${formatDate(post.date)}`,
    `slug: ${post.slug}`,
    post.lang ? `lang: "${escapeQuotes(post.lang)}"` : undefined,
    imageUrl ? `image: "${escapeQuotes(imageUrl)}"` : undefined
  ].filter(Boolean) as string[]

  const frontmatter = frontmatterLines.join('\n')
  const content = post.content ? htmlToMarkdown(post.content) : ''

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

function getOutputDir(): string {
  const outputPath = process.env.BLOG_MDX_OUTPUT_PATH || '../src/content/blog'
  return path.resolve(process.cwd(), outputPath)
}

async function writeMDXFile(post: BlogPost): Promise<string> {
  const baseDir = getOutputDir()

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  const filename = generateFilename(post)
  const filepath = path.join(baseDir, filename)
  fs.writeFileSync(filepath, generateMDX(post), 'utf-8')
  console.log(`✅ Generated blog post MDX: ${filepath}`)
  return filepath
}

async function fetchPublishedPost(documentId: string): Promise<BlogPost | null> {
  try {
    const post = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId,
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

    console.log(`📝 Creating blog post MDX: ${result.slug}`)
    const post = await fetchPublishedPost(result.documentId)
    if (!post) {
      console.log(`⏭️  No published version for blog post ${result.documentId}`)
      return
    }

    const filepath = await writeMDXFile(post)
    await gitCommitAndPush(filepath, `blog: add "${post.title}"`)
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`📝 Updating blog post MDX: ${result.slug}`)
    const post = await fetchPublishedPost(result.documentId)

    if (post) {
      const filepath = await writeMDXFile(post)
      await gitCommitAndPush(filepath, `blog: update "${post.title}"`)
    } else {
      // No published version -- clean up MDX if it exists on disk
      const baseDir = getOutputDir()
      const filepath = path.join(baseDir, generateFilename(result))
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        console.log(`🗑️  Deleted unpublished blog post MDX: ${filepath}`)
        await gitCommitAndPush(filepath, `blog: unpublish "${result.title}"`)
      }
    }
  },

  async afterDelete(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`🗑️  Deleting blog post MDX: ${result.slug}`)
    const baseDir = getOutputDir()
    const filepath = path.join(baseDir, generateFilename(result))

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
      console.log(`🗑️  Deleted blog post MDX: ${filepath}`)
      await gitCommitAndPush(filepath, `blog: delete "${result.title}"`)
    }
  }
}
