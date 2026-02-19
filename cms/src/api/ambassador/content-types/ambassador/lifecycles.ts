/**
 * Lifecycle callbacks for ambassador content type
 * Generates MDX files for the Astro content collection
 * Then commits and pushes to trigger Netlify builds
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'
import { getImageUrl } from '../../../../utils/mdx'
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
  return `${ambassador.slug}.mdx`
}

/** Serializes a value as a YAML scalar (double-quoted string or null). */
function yamlValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null'
  return JSON.stringify(value)
}

function generateMdxContent(ambassador: Ambassador): string {
  const photoUrl = getImageUrl(ambassador.photo, 'thumbnail') || null
  const photoAlt = ambassador.photo?.alternativeText || ambassador.name

  const fields = [
    `name: ${yamlValue(ambassador.name)}`,
    `slug: ${yamlValue(ambassador.slug)}`,
    `description: ${yamlValue(ambassador.description || '')}`,
    `photo: ${yamlValue(photoUrl)}`,
    `photoAlt: ${yamlValue(photoAlt)}`,
    `linkedinUrl: ${yamlValue(ambassador.linkedinUrl ?? null)}`,
    `grantReportUrl: ${yamlValue(ambassador.grantReportUrl ?? null)}`
  ]

  return `---\n${fields.join('\n')}\n---\n`
}

async function writeMdxFile(ambassador: Ambassador): Promise<void> {
  const baseDir = getBaseDir()
  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)

  try {
    await fs.promises.mkdir(baseDir, { recursive: true })
    const mdxContent = generateMdxContent(ambassador)
    await fs.promises.writeFile(filepath, mdxContent, 'utf-8')
    console.log(`✅ Generated Ambassador MDX file: ${filepath}`)
  } catch (error) {
    console.error(`❌ Failed to write Ambassador MDX file: ${filepath}`, error)
    throw error
  }
}

async function deleteMdxFile(ambassador: Ambassador): Promise<void> {
  const baseDir = getBaseDir()
  const filename = generateFilename(ambassador)
  const filepath = path.join(baseDir, filename)

  try {
    await fs.promises.unlink(filepath)
    console.log(`🗑️  Deleted Ambassador MDX file: ${filepath}`)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    console.error(`❌ Failed to delete Ambassador MDX file: ${filepath}`, error)
    throw error
  }
}

/**
 * Returns true when the request originates from the sync script.
 * The sync script sets `x-skip-mdx-export: true` so we don't re-write
 * MDX files that were the source of the import in the first place.
 */
function isImportRequest(): boolean {
  // strapi.requestContext uses AsyncLocalStorage — safe inside lifecycle hooks
  const headers = strapi.requestContext.get()?.request?.headers
  return headers?.['x-skip-mdx-export'] === 'true'
}

export default {
  async afterCreate(event: Event) {
    if (isImportRequest()) return
    const { result } = event
    if (result && result.publishedAt) {
      await writeMdxFile(result)
      const filepath = path.join(getBaseDir(), generateFilename(result))
      await gitCommitAndPush(filepath, `ambassador: add "${result.name}"`)
    }
  },

  async afterUpdate(event: Event) {
    if (isImportRequest()) return
    const { result } = event
    if (result) {
      const filepath = path.join(getBaseDir(), generateFilename(result))

      if (result.publishedAt) {
        await writeMdxFile(result)
        await gitCommitAndPush(filepath, `ambassador: update "${result.name}"`)
      } else {
        await deleteMdxFile(result)
        await gitCommitAndPush(
          filepath,
          `ambassador: unpublish "${result.name}"`
        )
      }
    }
  },

  async afterDelete(event: Event) {
    if (isImportRequest()) return
    const { result } = event
    if (result) {
      await deleteMdxFile(result)
      const filepath = path.join(getBaseDir(), generateFilename(result))
      await gitCommitAndPush(filepath, `ambassador: delete "${result.name}"`)
    }
  }
}
