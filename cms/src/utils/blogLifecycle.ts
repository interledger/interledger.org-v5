import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport } from './pageLifecycle'
import { scheduleGitSync, getTargetRepoRoot } from './gitSync'

interface BlogResult {
  id: number
  documentId: string
  title: string
  description: string
  pathSlug: string
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
      console.log(`📝 Creating ${label} MDX for: ${result.pathSlug}`)
      await writeMDXFile({
        outputPath: getOutputPath(result.locale),
        post: result
      })
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
