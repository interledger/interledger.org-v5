/**
 * Lifecycle callbacks for ambassador content type.
 * Mirrors createPageLifecycle: on any save, fetches every locale from Strapi
 * and writes all locale MDX files in one pass.
 *
 * This avoids the i18n "modified" badge that appeared when createFlatContentLifecycle
 * only wrote the single event.result locale, leaving other locales' MDX stale.
 */

import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport } from '../../../../utils/pageLifecycle'
import { getImageUrl, LOCALES } from '../../../../utils/mdx'
import { getContentPath, getProjectRoot } from '../../../../utils/paths'
import type { AmbassadorBase } from '../../types'

// Strapi v5 Document Service API (ambient — provided by the runtime)
interface StrapiDocumentAPI {
  findOne: (options: {
    documentId: string
    locale: string
    status: string
    populate: Record<string, unknown>
  }) => Promise<unknown>
}
declare const strapi: { documents: (uid: string) => StrapiDocumentAPI }

const CONTENT_TYPE_UID = 'api::ambassador.ambassador'

interface Ambassador extends AmbassadorBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

interface Event {
  result?: Ambassador
}

/** Serializes a value as a YAML scalar (double-quoted string or null). */
function yamlValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null'
  return JSON.stringify(value)
}

function generateMdxContent(ambassador: Ambassador): string {
  const photoUrl = getImageUrl(ambassador.photo, 'thumbnail') || null
  const photoAlt = ambassador.photo?.alternativeText || ambassador.name
  const locale =
    ambassador.locale && ambassador.locale !== 'en'
      ? ambassador.locale
      : undefined

  const fields = [
    `name: ${yamlValue(ambassador.name)}`,
    `slug: ${yamlValue(ambassador.slug)}`,
    `description: ${yamlValue(ambassador.description || '')}`,
    `photo: ${yamlValue(photoUrl)}`,
    `photoAlt: ${yamlValue(photoAlt)}`,
    `linkedinUrl: ${yamlValue(ambassador.linkedinUrl ?? null)}`,
    `grantReportUrl: ${yamlValue(ambassador.grantReportUrl ?? null)}`,
    ...(locale ? [`locale: ${yamlValue(locale)}`] : [])
  ]

  return `---\n${fields.join('\n')}\n---\n`
}

async function fetchPublished(
  documentId: string,
  locale: string
): Promise<Ambassador | null> {
  try {
    const result = await strapi.documents(CONTENT_TYPE_UID).findOne({
      documentId,
      locale,
      status: 'published',
      populate: { photo: true }
    })
    return result as Ambassador | null
  } catch (error) {
    console.error(
      `Failed to fetch ambassador ${documentId} (${locale}):`,
      error
    )
    return null
  }
}

async function writeMdxFile(ambassador: Ambassador): Promise<string> {
  const baseDir = getContentPath(getProjectRoot(), 'ambassadors', ambassador.locale)
  const filepath = path.join(baseDir, `${ambassador.slug}.mdx`)
  await fs.promises.mkdir(baseDir, { recursive: true })
  await fs.promises.writeFile(filepath, generateMdxContent(ambassador), 'utf-8')
  console.log(`✅ Generated ambassador MDX: ${filepath}`)
  return filepath
}

/** Fetches and writes MDX for every configured locale. Returns written paths. */
async function exportAllLocales(documentId: string): Promise<string[]> {
  const filepaths: string[] = []
  for (const locale of LOCALES) {
    try {
      const ambassador = await fetchPublished(documentId, locale)
      if (!ambassador) {
        console.log(`⏭️  No published ${locale} ambassador for ${documentId}`)
        continue
      }
      const filepath = await writeMdxFile(ambassador)
      filepaths.push(filepath)
    } catch (error) {
      console.error(
        `⚠️  Failed to export ${locale} ambassador for ${documentId}:`,
        error
      )
    }
  }
  return filepaths
}

export default {
  async afterCreate(event: Event) {
    if (shouldSkipMdxExport()) return
    const { result } = event
    if (!result?.documentId || !result.publishedAt) return

    console.log(`📝 Creating ambassador MDX for all locales: ${result.slug}`)
    await exportAllLocales(result.documentId)
  },

  async afterUpdate(event: Event) {
    if (shouldSkipMdxExport()) return
    const { result } = event
    if (!result?.documentId) return

    console.log(`📝 Updating ambassador MDX for all locales: ${result.slug}`)
    const filepaths = await exportAllLocales(result.documentId)

    // Remove MDX for any locale that is no longer published
    for (const locale of LOCALES) {
      const baseDir = getContentPath(getProjectRoot(), 'ambassadors', locale)
      const filepath = path.join(baseDir, `${result.slug}.mdx`)
      if (!filepaths.includes(filepath) && fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
          console.log(
            `🗑️  Deleted unpublished ${locale} ambassador MDX: ${filepath}`
          )
        } catch (error) {
          console.error(
            `Failed to delete ${locale} ambassador MDX: ${filepath}`,
            error
          )
        }
      }
    }
  },

  async afterDelete(event: Event) {
    if (shouldSkipMdxExport()) return
    const { result } = event
    if (!result) return

    console.log(`🗑️  Deleting ambassador MDX for all locales: ${result.slug}`)
    for (const locale of LOCALES) {
      const baseDir = getContentPath(getProjectRoot(), 'ambassadors', locale)
      const filepath = path.join(baseDir, `${result.slug}.mdx`)
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
          console.log(`🗑️  Deleted ${locale} ambassador MDX: ${filepath}`)
        } catch (error) {
          console.error(
            `Failed to delete ${locale} ambassador MDX: ${filepath}`,
            error
          )
        }
      }
    }

  }
}
