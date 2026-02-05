/**
 * Lifecycle callbacks for ambassador content type
 * Generates JSON files for the Astro content collection
 * Then commits and pushes to trigger Netlify builds
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'

interface MediaFile {
  id: number
  url: string
  alternativeText?: string
  name?: string
  width?: number
  height?: number
  formats?: {
    thumbnail?: { url: string }
    small?: { url: string }
    medium?: { url: string }
    large?: { url: string }
  }
}

interface Ambassador {
  id: number
  name: string
  slug: string
  description: string
  photo?: MediaFile
  linkedinUrl?: string
  grantReportUrl?: string
  order?: number
  publishedAt?: string
}

interface Event {
  result?: Ambassador
}

/**
 * Converts markdown to HTML
 * Handles: bold, italic, links, line breaks
 */
function markdownToHtml(markdown: string): string {
  if (!markdown) return ''

  return markdown
    // Bold: **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    // Wrap in paragraph if not already
    .replace(/^(?!<p>)/, '<p>')
    .replace(/(?!<\/p>)$/, '</p>')
}

/**
 * Strips HTML/markdown and converts to plain text
 */
function toPlainText(text: string): string {
  if (!text) return ''

  return text
    // Remove markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove markdown links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
}

/**
 * Gets the image URL from a media field
 * Returns the full Strapi URL for local files, or the full URL for external
 */
function getImageUrl(media: MediaFile | undefined): string | undefined {
  if (!media?.url) return undefined

  // Use thumbnail format if available for ambassador photos
  if (media.formats?.thumbnail?.url) {
    const thumbnailUrl = media.formats.thumbnail.url
    if (thumbnailUrl.startsWith('/uploads/')) {
      const uploadsBase = process.env.STRAPI_UPLOADS_BASE_URL
      return uploadsBase
        ? `${uploadsBase.replace(/\/$/, '')}${thumbnailUrl}`
        : thumbnailUrl
    }
    return thumbnailUrl
  }

  // Fallback to main URL
  if (media.url.startsWith('/uploads/')) {
    const uploadsBase = process.env.STRAPI_UPLOADS_BASE_URL
    return uploadsBase
      ? `${uploadsBase.replace(/\/$/, '')}${media.url}`
      : media.url
  }

  return media.url
}

function generateFilename(ambassador: Ambassador): string {
  return `${ambassador.slug}.json`
}

function generateJSON(ambassador: Ambassador): string {
  const data = {
    name: ambassador.name,
    slug: ambassador.slug,
    description: markdownToHtml(ambassador.description),
    descriptionPlainText: toPlainText(ambassador.description),
    photo: getImageUrl(ambassador.photo),
    photoAlt: ambassador.photo?.alternativeText || ambassador.name,
    linkedinUrl: ambassador.linkedinUrl || null,
    grantReportUrl: ambassador.grantReportUrl || null,
    order: ambassador.order || 0
  }

  return JSON.stringify(data, null, 2)
}

async function writeJSONFile(ambassador: Ambassador): Promise<void> {
  const outputPath =
    process.env.AMBASSADOR_JSON_OUTPUT_PATH || '../src/content/ambassadors'
  // Resolve from dist/src/api/ambassador/content-types/ambassador/ up to cms root then project root
  const baseDir = path.resolve(__dirname, '../../../../../../', outputPath)

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)
  const jsonContent = generateJSON(ambassador)

  fs.writeFileSync(filepath, jsonContent, 'utf-8')
  console.log(`✅ Generated Ambassador JSON file: ${filepath}`)
}

async function deleteJSONFile(ambassador: Ambassador): Promise<void> {
  const outputPath =
    process.env.AMBASSADOR_JSON_OUTPUT_PATH || '../src/content/ambassadors'
  const baseDir = path.resolve(__dirname, '../../../../../../', outputPath)
  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
    console.log(`🗑️  Deleted Ambassador JSON file: ${filepath}`)
  }
}

export default {
  async afterCreate(event: Event) {
    const { result } = event
    if (result && result.publishedAt) {
      await writeJSONFile(result)
      const filename = generateFilename(result)
      const outputPath =
        process.env.AMBASSADOR_JSON_OUTPUT_PATH || '../src/content/ambassadors'
      const baseDir = path.resolve(__dirname, '../../../../../../', outputPath)
      const filepath = path.join(baseDir, filename)
      await gitCommitAndPush(filepath, `ambassador: add "${result.name}"`)
    }
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (result) {
      const filename = generateFilename(result)
      const outputPath =
        process.env.AMBASSADOR_JSON_OUTPUT_PATH || '../src/content/ambassadors'
      const baseDir = path.resolve(__dirname, '../../../../../../', outputPath)
      const filepath = path.join(baseDir, filename)

      if (result.publishedAt) {
        await writeJSONFile(result)
        await gitCommitAndPush(filepath, `ambassador: update "${result.name}"`)
      } else {
        await deleteJSONFile(result)
        await gitCommitAndPush(
          filepath,
          `ambassador: unpublish "${result.name}"`
        )
      }
    }
  },

  async afterDelete(event: Event) {
    const { result } = event
    if (result) {
      await deleteJSONFile(result)
      const filename = generateFilename(result)
      const outputPath =
        process.env.AMBASSADOR_JSON_OUTPUT_PATH || '../src/content/ambassadors'
      const baseDir = path.resolve(__dirname, '../../../../../../', outputPath)
      const filepath = path.join(baseDir, filename)
      await gitCommitAndPush(filepath, `ambassador: delete "${result.name}"`)
    }
  }
}
