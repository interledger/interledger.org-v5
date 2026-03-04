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
  localizations: []
}

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
}
//TODO: git

function generateFilename({ date, slug }): string {
  const prefix = date ? `${date}-` : ''
  return `${prefix}${slug}.mdx`
}

function generateBlogMDX(post: BlogResult) {
  const articleBios =
    post.articleBio?.length > 0
      ? `articleBios:${post.articleBio.map((bio) => {
          const articleBio = [
            `\n  - author: ${bio.author}`,
            bio.profileBio ? `\n    text: '${bio.profileBio}'` : null,
            bio.profileImage ? `\n    image: '${bio.profileImage.url}'` : null
          ]
            .filter(Boolean)
            .join('')
          return articleBio
        })}`
      : null

  const frontmatterLines = [
    `title: '${post.title}'`,
    `description: '${post.description}'`,
    `date: ${post.date}`,
    `slug: ${post.slug}`,
    `pillar: '${post.pillar}'`,
    post.featureImage ? `featureImage: '${post.featureImage.url}'` : null,
    post.featureImage?.alternativeText
      ? `featureImageAlt: '${post.featureImage.alternativeText}'`
      : null,
    post.thumbnailImage ? `thumbnailImage: '${post.thumbnailImage.url}'` : null,
    post.thumbnailImage?.alternativeText
      ? `thumbnailImageAlt: '${post.thumbnailImage.alternativeText}'`
      : null,
    articleBios,
    post.tags.length > 0
      ? `tags: ${post.tags.map((tag) => `\n  - ${tag.tagValue}`).join('')}`
      : null,
    post.language ? `locale: ${post.language}` : null
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
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`❌ Failed to delete MDX file: ${filepath}`, err)
      throw err
    }
  }
}

export function createBlogLifecycle({ outputDir }) {
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
