/**
 * Lifecycle callbacks for foundation blog-post.
 * Generates MDX files then commits and pushes to trigger Netlify preview builds.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getProjectRoot, getContentPath } from '../../../../utils/paths'
import { syncToGit } from '../../../../utils/gitSync'
import { shouldSkipMdxExport } from '../../../../utils/mdxLifecycle'
import {
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
  featuredImage?: { url?: string; alternativeText?: string }
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
  preservedFields: Record<string, unknown> = {},
  englishSlug?: string
): string {
  const imageUrl = getImageUrl(post.featuredImage)
  const langValue = post.lang || locale
  const { localizes, ...restPreserved } = preservedFields
  const localizesValue =
    localizes || (locale !== 'en' && englishSlug ? englishSlug : undefined)

  // Spread preserved fields first, then Strapi-managed fields overwrite
  const frontmatterData: Record<string, unknown> = {
    ...restPreserved,
    title: post.title,
    description: post.description,
    date: formatDate(post.date),
    slug: post.slug,
    lang: langValue,
    ...(post.ogImageUrl ? { ogImageUrl: post.ogImageUrl } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(localizesValue ? { localizes: localizesValue } : {}),
    ...(locale !== 'en' ? { locale } : {}),
  }

  const content = post.content ? htmlToMarkdown(post.content) : ''

  return matter.stringify(content ? `\n${content}\n` : '\n', frontmatterData)
}

function getOutputDir(locale: string): string {
  const projectRoot = getProjectRoot()
  return getContentPath(projectRoot, 'blog', locale === 'en' ? undefined : locale)
}

async function writeMDXFile(
  post: BlogPost,
  locale: string,
  englishSlug?: string
): Promise<string> {
  const baseDir = getOutputDir(locale)
  const filename = generateFilename(post)
  const filepath = path.join(baseDir, filename)

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    // Preserve fields that exist in MDX but not in Strapi
    const preservedFields = getPreservedFields(filepath)
    fs.writeFileSync(
      filepath,
      generateMDX(post, locale, preservedFields, englishSlug),
      'utf-8'
    )
    console.log(`✅ Generated blog post MDX: ${filepath}`)
    return filepath
  } catch (error) {
    console.error(`Failed to write blog post MDX file: ${filepath}`, error)
    throw error
  }
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
    if (shouldSkipMdxExport()) return

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
      await syncToGit(filepaths, `blog: add "${result.title}"`)
    }
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (!result) return
    if (shouldSkipMdxExport()) return

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
          try {
            fs.unlinkSync(filepath)
            console.log(`🗑️  Deleted unpublished ${locale} blog post MDX: ${filepath}`)
            deletedPaths.push(filepath)
          } catch (error) {
            console.error(`Failed to delete unpublished ${locale} blog post MDX: ${filepath}`, error)
          }
        }
      }
    }

    const allPaths = [...filepaths, ...deletedPaths]
    if (allPaths.length > 0) {
      await syncToGit(allPaths, `blog: update "${result.title}"`)
    }
  },

  async afterDelete(event: Event) {
    const { result } = event
    if (!result) return
    if (shouldSkipMdxExport()) return

    console.log(`🗑️  Deleting blog post MDX for all locales: ${result.slug}`)
    const deletedPaths: string[] = []

    for (const locale of LOCALES) {
      const baseDir = getOutputDir(locale)
      const filepath = path.join(baseDir, generateFilename(result))

      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
          console.log(`🗑️  Deleted ${locale} blog post MDX: ${filepath}`)
          deletedPaths.push(filepath)
        } catch (error) {
          console.error(`Failed to delete ${locale} blog post MDX: ${filepath}`, error)
        }
      }
    }

    if (deletedPaths.length > 0) {
      await syncToGit(deletedPaths, `blog: delete "${result.title}"`)
    }
  }
}
