import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport } from './pageLifecycle'
import { getProjectRoot } from './paths'

interface BlogResult {
  id: number
  documentId: string
  title: string
  description: string
  slug: string
  date: string
  content: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  locale: string
  pillar: 'vision' | 'mission' | 'tech' | 'values'
  language?: 'en' | 'es'
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
    profileImage?: { url: string }
  }[]
  tags?: { tagValue: string }[]
  localizations: string[]
}

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
}

function yamlSingleQuote(value: string): string {
  return `${value.replace(/'/g, "''").replace(/\r\n/g, '\n')}`
}
const q = yamlSingleQuote

function generateFilename({
  date,
  slug
}: {
  date: string
  slug: string
}): string {
  const prefix = date ? `${date}-` : ''
  return `${prefix}${slug}.mdx`
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
    `slug: ${post.slug}`,
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
        : `tags: ${post.tags.map((tag) => `\n  - ${q(tag.tagValue)}`).join('')}`
      : null,
    post.language ? `locale: ${q(post.language)}` : null
  ].filter(Boolean) as string[]

  const frontmatter = frontmatterLines.join('\n')
  const content = post.content ?? ''

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile({
  outputPath,
  post
}: {
  outputPath: string
  post: BlogResult
}) {
  const filename = generateFilename({ date: post.date, slug: post.slug })
  const filepath = path.join(outputPath, filename)
  const mdxContent = generateBlogMDX(post)

  await fs.promises.mkdir(outputPath, { recursive: true })
  await fs.promises.writeFile(filepath, mdxContent, 'utf-8')

  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
}

async function deleteMDXFile({
  outputPath,
  post
}: {
  outputPath: string
  post: BlogResult
}) {
  const filename = generateFilename({ date: post.date, slug: post.slug })
  const filepath = path.join(outputPath, filename)

  try {
    await fs.promises.unlink(filepath)
    console.log(`🗑️  Deleted MDX file: ${filepath}`)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(
        `❌ Failed to delete Blog Post MDX file: ${filepath}`,
        error
      )
      throw error
    }
  }
}

export function createBlogLifecycle({ outputDir }: { outputDir: string }) {
  const projectRoot = getProjectRoot()
  const outputPath = path.join(projectRoot, outputDir)

  return {
    async afterCreate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      console.log(
        `📝 Creating ${event.model.singularName} MDX for: ${result.slug}`
      )
      await writeMDXFile({ outputPath, post: result })
    },

    async afterDelete(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      console.log(
        `📝 Deleting ${event.model.singularName} MDX for: ${result.slug}`
      )
      await deleteMDXFile({ outputPath, post: result })
    }
  }
}




// /**
//  * Lifecycle hooks for foundation-blog-post content type.
//  * Exports MDX when blog posts are created/updated/deleted in Strapi, with git sync.
//  */

// declare const strapi: {
//   documents: (uid: string) => {
//     findOne: (options: {
//       documentId: string
//       locale: string
//       status: string
//       populate: Record<string, unknown>
//     }) => Promise<unknown>
//   }
// }

// import fs from 'fs'
// import path from 'path'
// import matter from 'gray-matter'
// import { getProjectRoot, PATHS } from './paths'
// import { LOCALES, getImageUrl, htmlToMarkdown } from './mdx'
// import { shouldSkipMdxExport, commitPaths } from './lifecycleUtils'

// const CONTENT_TYPE_UID = 'api::foundation-blog-post.foundation-blog-post'

// interface BlogData {
//   documentId: string
//   title: string
//   slug: string
//   date?: string
//   pillar?: string
//   description?: string
//   featureImage?: { url?: string; alternativeText?: string }
//   thumbnailImage?: { url?: string; alternativeText?: string }
//   authors?: string
//   content?: string
//   locale?: string
//   [key: string]: unknown
// }

// interface Event {
//   result?: BlogData
// }

// function getOutputDir(locale: string): string {
//   const projectRoot = getProjectRoot()
//   const subdir = PATHS.CONTENT.blog
//   if (locale === 'en') {
//     return path.join(projectRoot, PATHS.CONTENT_ROOT, subdir)
//   }
//   return path.join(projectRoot, PATHS.CONTENT_ROOT, locale, subdir)
// }

// function formatDate(date: string | undefined): string {
//   if (!date) return ''
//   const d = new Date(date)
//   return d.toISOString().split('T')[0]
// }

// function blogToMdxContent(blog: BlogData): string {
//   const dateStr = formatDate(blog.date)
//   const frontmatter: Record<string, unknown> = {
//     title: blog.title,
//     description: blog.description || '',
//     date: dateStr,
//     slug: blog.slug,
//     pillar: blog.pillar || 'vision'
//   }

//   if (blog.featureImage?.url) {
//     frontmatter.featureImage = getImageUrl(blog.featureImage) || blog.featureImage.url
//     if (blog.featureImage.alternativeText) {
//       frontmatter.featureImageAlt = blog.featureImage.alternativeText
//     }
//   }
//   if (blog.thumbnailImage?.url) {
//     frontmatter.thumbnailImage = getImageUrl(blog.thumbnailImage) || blog.thumbnailImage.url
//     if (blog.thumbnailImage.alternativeText) {
//       frontmatter.thumbnailImageAlt = blog.thumbnailImage.alternativeText
//     }
//   }
//   if (blog.authors) {
//     frontmatter.authors = blog.authors.split(',').map((a) => a.trim()).filter(Boolean)
//   }
//   if (blog.locale && blog.locale !== 'en') {
//     frontmatter.locale = blog.locale
//   }

//   const body = blog.content
//     ? htmlToMarkdown(blog.content)
//     : ''
//   return matter.stringify(body ? `\n${body}\n` : '\n', frontmatter)
// }

// async function fetchPublishedBlog(
//   documentId: string,
//   locale: string
// ): Promise<BlogData | null> {
//   try {
//     const doc = await strapi.documents(CONTENT_TYPE_UID).findOne({
//       documentId,
//       locale,
//       status: 'published',
//       populate: {
//         featureImage: { populate: '*' },
//         thumbnailImage: { populate: '*' }
//       }
//     })
//     return doc as BlogData | null
//   } catch (error) {
//     console.error(
//       `Failed to fetch foundation-blog-post ${documentId} (${locale}):`,
//       error
//     )
//     return null
//   }
// }

// async function exportAllLocales(documentId: string): Promise<string[]> {
//   const filepaths: string[] = []

//   for (const locale of LOCALES) {
//     const blog = await fetchPublishedBlog(documentId, locale)
//     if (!blog) continue

//     const dateStr = formatDate(blog.date)
//     const filename = `${dateStr}-${blog.slug}.mdx`
//     const outputDir = getOutputDir(locale)
//     const filepath = path.join(outputDir, filename)

//     try {
//       if (!fs.existsSync(outputDir)) {
//         fs.mkdirSync(outputDir, { recursive: true })
//       }
//       fs.writeFileSync(filepath, blogToMdxContent(blog), 'utf-8')
//       console.log(`✅ Generated foundation-blog-post MDX: ${filepath}`)
//       filepaths.push(filepath)
//     } catch (error) {
//       console.error(`Failed to write foundation-blog-post MDX: ${filepath}`, error)
//     }
//   }

//   return filepaths
// }

// function findExistingMdxFiles(slug: string): string[] {
//   const projectRoot = getProjectRoot()
//   const found: string[] = []

//   for (const locale of LOCALES) {
//     const outputDir = getOutputDir(locale)
//     if (!fs.existsSync(outputDir)) continue

//     const files = fs.readdirSync(outputDir)
//     const match = files.find((f) => f.endsWith(`-${slug}.mdx`))
//     if (match) {
//       found.push(path.join(outputDir, match))
//     }
//   }
//   return found
// }

// export function createBlogLifecycle() {
//   return {
//     async afterCreate(event: Event) {
//       const { result } = event
//       if (!result) return
//       if (shouldSkipMdxExport()) return

//       console.log(
//         `📝 Creating foundation-blog-post MDX for all locales: ${result.slug}`
//       )
//       const filepaths = await exportAllLocales(result.documentId)
//       await commitPaths(
//         filepaths,
//         `foundation-blog-post: create ${result.slug}`
//       )
//     },

//     async afterUpdate(event: Event) {
//       const { result } = event
//       if (!result) return
//       if (shouldSkipMdxExport()) return

//       console.log(
//         `📝 Updating foundation-blog-post MDX for all locales: ${result.slug}`
//       )
//       const filepaths = await exportAllLocales(result.documentId)

//       const oldFiles = findExistingMdxFiles(result.slug)
//       const deletedPaths: string[] = []
//       for (const oldPath of oldFiles) {
//         if (!filepaths.includes(oldPath) && fs.existsSync(oldPath)) {
//           fs.unlinkSync(oldPath)
//           console.log(`🗑️  Deleted foundation-blog-post MDX: ${oldPath}`)
//           deletedPaths.push(oldPath)
//         }
//       }

//       await commitPaths(
//         [...filepaths, ...deletedPaths],
//         `foundation-blog-post: update ${result.slug}`
//       )
//     },

//     async afterDelete(event: Event) {
//       const { result } = event
//       if (!result) return
//       if (shouldSkipMdxExport()) return

//       console.log(
//         `🗑️  Deleting foundation-blog-post MDX for all locales: ${result.slug}`
//       )
//       const deletedPaths = findExistingMdxFiles(result.slug)

//       for (const filepath of deletedPaths) {
//         if (fs.existsSync(filepath)) {
//           fs.unlinkSync(filepath)
//           console.log(`🗑️  Deleted foundation-blog-post MDX: ${filepath}`)
//         }
//       }

//       await commitPaths(
//         deletedPaths,
//         `foundation-blog-post: delete ${result.slug}`
//       )