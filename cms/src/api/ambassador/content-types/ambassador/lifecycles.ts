/**
 * Lifecycle callbacks for ambassador content type
 * Generates JSON files for the Astro content collection
 * Then commits and pushes to trigger Netlify builds
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'
import { getImageUrl, markdownToHtml, toPlainText } from '../../../../utils/mdx'
import { getContentPath, getProjectRoot } from '../../../../utils/paths'
import type { AmbassadorBase } from '../../types'

interface Ambassador extends AmbassadorBase {
  publishedAt?: string
}

interface Event {
  result?: Ambassador
}

function getBaseDir(): string {
  return getContentPath(getProjectRoot(), 'ambassadors')
}

function generateFilename(ambassador: Ambassador): string {
  return `${ambassador.slug}.json`
}

function generateJSON(ambassador: Ambassador): string {
  const data = {
    name: ambassador.name,
    slug: ambassador.slug,
    description: markdownToHtml(ambassador.description || ''),
    descriptionPlainText: toPlainText(ambassador.description || ''),
    photo: getImageUrl(ambassador.photo, 'thumbnail'),
    photoAlt: ambassador.photo?.alternativeText || ambassador.name,
    linkedinUrl: ambassador.linkedinUrl || null,
    grantReportUrl: ambassador.grantReportUrl || null
  }

  return JSON.stringify(data, null, 2)
}

async function writeJSONFile(ambassador: Ambassador): Promise<void> {
  const baseDir = getBaseDir()
  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    const jsonContent = generateJSON(ambassador)
    fs.writeFileSync(filepath, jsonContent, 'utf-8')
    console.log(`✅ Generated Ambassador JSON file: ${filepath}`)
  } catch (error) {
    console.error(`❌ Failed to write Ambassador JSON file: ${filepath}`, error)
    throw error
  }
}

async function deleteJSONFile(ambassador: Ambassador): Promise<void> {
  const baseDir = getBaseDir()
  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
      console.log(`🗑️  Deleted Ambassador JSON file: ${filepath}`)
    }
  } catch (error) {
    console.error(`❌ Failed to delete Ambassador JSON file: ${filepath}`, error)
    throw error
  }
}

export default {
  async afterCreate(event: Event) {
    const { result } = event
    if (result && result.publishedAt) {
      await writeJSONFile(result)
      const filepath = path.join(getBaseDir(), generateFilename(result))
      await gitCommitAndPush(filepath, `ambassador: add "${result.name}"`)
    }
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (result) {
      const filepath = path.join(getBaseDir(), generateFilename(result))

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
      const filepath = path.join(getBaseDir(), generateFilename(result))
      await gitCommitAndPush(filepath, `ambassador: delete "${result.name}"`)
    }
  }
}
