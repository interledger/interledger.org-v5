import fs from 'fs'
import path from 'path'
import { escapeQuotes, htmlToMarkdown } from '../../../../utils/mdx'

interface GrantTrack {
  id: number
  name: string
  amount: string
  description: string
  order?: number
  publishedAt?: string
}

interface Event {
  result?: GrantTrack
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function getOutputDir(): string {
  const outputPath = process.env.GRANT_TRACK_MDX_OUTPUT_PATH || '../src/content/grants'
  return path.resolve(process.cwd(), outputPath)
}

function generateFilename(grant: GrantTrack): string {
  return `${slugify(grant.name)}-${grant.id}.mdx`
}

function generateMDX(grant: GrantTrack): string {
  const frontmatter = [
    `name: "${escapeQuotes(grant.name)}"`,
    `amount: "${escapeQuotes(grant.amount)}"`,
    `order: ${grant.order ?? 0}`,
    `description: "${escapeQuotes(grant.description)}"`
  ].join('\n')

  const content = htmlToMarkdown(grant.description)

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile(grant: GrantTrack): Promise<void> {
  const baseDir = getOutputDir()

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  const filepath = path.join(baseDir, generateFilename(grant))
  fs.writeFileSync(filepath, generateMDX(grant), 'utf-8')
  console.log(`✅ Generated grant track MDX: ${filepath}`)
}

async function deleteMDXFile(grant: GrantTrack): Promise<void> {
  const baseDir = getOutputDir()
  const filepath = path.join(baseDir, generateFilename(grant))

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
    console.log(`🗑️  Deleted grant track MDX: ${filepath}`)
  }
}

export default {
  async afterCreate(event: Event) {
    const { result } = event
    if (result && result.publishedAt) {
      await writeMDXFile(result)
    }
  },
  async afterUpdate(event: Event) {
    const { result } = event
    if (result) {
      if (result.publishedAt) {
        await writeMDXFile(result)
      } else {
        await deleteMDXFile(result)
      }
    }
  },
  async afterDelete(event: Event) {
    const { result } = event
    if (result) {
      await deleteMDXFile(result)
    }
  }
}
