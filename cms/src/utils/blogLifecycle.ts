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
  authors?: string
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
  articleBio?: { profileBio: string; profileImage: string }[]
  tags?: { tagValue: string }[]
  localizations: []
}

interface BlogEvent {
  model: { singularName: string }
  result: BlogResult
}
//TODO: use documentID, not ID - each entry has draft and published with same documentID, but differents IDs
//TODO: git

function generateFilename({ date, slug }): string {
  const prefix = date ? `${date}-` : ''
  return `${prefix}${slug}.mdx`
}

function generateBlogMDX(post: BlogResult) {
  console.log('POST: ', post)
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
    post.authors ? `authors: ${post.authors[0]}` : null, //TODO - group together author + articleBio
    post.articleBio.length > 0
      ? `bioTexts: '${post.articleBio[0].profileBio}'`
      : null,
    post.articleBio.length > 0
      ? `bioImages: '${post.articleBio[0].profileImage}'`
      : null,
    post.tags.length > 0
      ? `tags: ${post.tags.map((tag) => `\n  - ${tag.tagValue}`).join('')}`
      : null,
    post.language ? `locale: ${post.language}` : null
  ].filter(Boolean) as string[]

  const frontmatter = frontmatterLines.join('\n')
  const content = post.content ?? '' //TODO CKEditor format to markdown

  return `---\n${frontmatter}\n---\n\n${content}\n`
}
async function writeMDXFile(outputDir: string, post: BlogResult) {
  const projectRoot = getProjectRoot()
  const filename = generateFilename({ date: post.date, slug: post.slug })
  const filepath = path.join(projectRoot, outputDir, filename)
  console.log('FILEPATH: ', filepath)
  const mdxContent = generateBlogMDX(post)

  await fs.promises.writeFile(filepath, mdxContent, 'utf-8')

  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
}

function updateMDXFile() {
  //TODO
}

function deleteMDXFile() {
  //TODO
}

export function createBlogLifecycle({ outputDir }) {
  return {
    async afterCreate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result || !result.publishedAt) return
      console.log(
        `📝 Creating ${event.model.singularName} MDX for: ${result.slug}`
      )
      writeMDXFile(outputDir, result)
    },

    async afterUpdate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      if (result.publishedAt) {
        updateMDXFile()
      } else {
        deleteMDXFile()
      }

      console.log(
        `📝 Updating ${event.model.singularName} MDX for: ${result.slug}`
      )
    },

    async afterDelete(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      deleteMDXFile()

      console.log(
        `📝 Deleting ${event.model.singularName} MDX for: ${result.slug}`
      )
    }
  }
}
