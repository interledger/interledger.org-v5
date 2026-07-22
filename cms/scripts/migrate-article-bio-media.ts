#!/usr/bin/env node

/**
 * Migrate existing `shared.article-bio` entries (on foundation-blog-post's
 * repeatable `articleBio` field) to the new `shared.localized-media` shape
 * (nested `media: { image, alternativeText }` instead of a flat `profileImage`
 * whose alt text lived on the Strapi upload's global, non-localized
 * alternativeText).
 *
 * Deploying the new `shared.article-bio` schema (media component field
 * replacing the flat `profileImage` attribute) makes Strapi drop the old
 * relation on restart — so the old data must be captured *before* the schema
 * change, and written back *after* it, in two separate runs:
 *
 *   1. Before deploying the new schema:
 *        pnpm --dir cms tsx scripts/migrate-article-bio-media.ts dump
 *      Reads every foundation-blog-post's `articleBio` entries (across all
 *      locales) and writes each bio's old `profileImage` upload ID + the
 *      upload's current native alternativeText to a JSON backup file.
 *
 *   2. Deploy the new schema (restart Strapi so it picks up
 *      `article-bio.json` and `localized-media.json`).
 *
 *   3. After the schema is live:
 *        pnpm --dir cms tsx scripts/migrate-article-bio-media.ts restore
 *      Reads the backup file and PUTs each post's `articleBio` field back
 *      with the bios rewritten into the new `media` shape.
 *
 * Both steps default to a dry run — pass `--apply` to actually write.
 *
 * INTORG-878
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { getProjectRoot } from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'
import { createStrapiClient, type StrapiEntry } from './sync-mdx/strapiClient'

const API_ID = 'foundation-blog-posts'

const BACKUP_PATH = path.resolve(
  __dirname,
  '../.article-bio-media-migration-backup.json'
)

interface OldArticleBio {
  documentId: string
  locale: string
  bioIndex: number
  image: number | null
  alternativeText: string | null
}

type ArticleBioBlock = {
  author?: string | null
  link?: string | null
  profileBio?: string | null
  profileImage?: number | { id?: number; alternativeText?: string } | null
  media?: { image: number | null; alternativeText: string }
  [key: string]: unknown
}

function withArticleBio(entry: StrapiEntry): ArticleBioBlock[] {
  return Array.isArray(entry.articleBio)
    ? (entry.articleBio as ArticleBioBlock[])
    : []
}

function imageId(image: ArticleBioBlock['profileImage']): number | null {
  if (image == null) return null
  return typeof image === 'number' ? image : (image.id ?? null)
}

function imageAlt(image: ArticleBioBlock['profileImage']): string | null {
  return typeof image === 'object' && image ? (image.alternativeText ?? null) : null
}

async function dump(
  strapi: ReturnType<typeof createStrapiClient>,
  apply: boolean
) {
  const found: OldArticleBio[] = []

  const entries = await strapi.request(
    `${API_ID}?locale=all&pagination[pageSize]=100&populate[articleBio][populate]=*`
  )
  if (entries instanceof Error) throw entries
  const data = (entries as { data?: StrapiEntry[] }).data ?? []

  for (const entry of data) {
    withArticleBio(entry).forEach((bio, bioIndex) => {
      if (bio.profileImage == null) return
      found.push({
        documentId: entry.documentId,
        locale: entry.locale ?? 'en',
        bioIndex,
        image: imageId(bio.profileImage),
        alternativeText: imageAlt(bio.profileImage)
      })
    })
  }

  console.log(`Found ${found.length} article-bio photo instance(s).`)

  if (!apply) {
    console.log(
      '🔍 Dry run — nothing written. Pass --apply to write the backup file.'
    )
    return
  }

  fs.writeFileSync(BACKUP_PATH, JSON.stringify(found, null, 2), 'utf-8')
  console.log(`✅ Backup written to ${BACKUP_PATH}`)
}

async function restore(
  strapi: ReturnType<typeof createStrapiClient>,
  apply: boolean
) {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error(
      `❌ No backup file at ${BACKUP_PATH} — run the "dump" step first, before deploying the new schema.`
    )
    process.exit(1)
  }
  const backup: OldArticleBio[] = JSON.parse(
    fs.readFileSync(BACKUP_PATH, 'utf-8')
  )

  const byEntry = new Map<string, OldArticleBio[]>()
  for (const row of backup) {
    const key = `${row.documentId}::${row.locale}`
    const bucket = byEntry.get(key) ?? []
    bucket.push(row)
    byEntry.set(key, bucket)
  }

  let updated = 0
  let skipped = 0

  for (const [key, rows] of byEntry) {
    const [documentId, locale] = key.split('::')

    const current = await strapi.request(
      `${API_ID}/${documentId}?locale=${locale}&populate[articleBio][populate]=*`
    )
    if (current instanceof Error) throw current
    const entry = (current as { data?: StrapiEntry }).data
    if (!entry) {
      console.warn(`⏭️  ${key} — entry no longer exists, skipping`)
      skipped++
      continue
    }

    const articleBio = withArticleBio(entry)
    let changed = false

    for (const row of rows) {
      const bio = articleBio[row.bioIndex]
      if (!bio) {
        console.warn(
          `⏭️  ${key} bio #${row.bioIndex} — no longer exists, skipping`
        )
        skipped++
        continue
      }
      if (bio.media) continue // already migrated

      bio.media = {
        image: row.image,
        alternativeText: row.alternativeText ?? ''
      }
      delete bio.profileImage
      changed = true
    }

    if (!changed) continue

    if (!apply) {
      console.log(`🔍 ${key} — would update ${rows.length} bio(s)`)
      updated++
      continue
    }

    const result = await strapi.updateEntry(
      API_ID,
      documentId,
      { articleBio },
      locale
    )
    if (result instanceof Error) throw result
    console.log(`✅ ${key} — updated ${rows.length} bio(s)`)
    updated++
  }

  console.log(`\n📊 Updated: ${updated}, skipped: ${skipped}`)
  if (!apply) {
    console.log('🔍 This was a dry run. Re-run with --apply to write changes.')
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'dump' && mode !== 'restore') {
    console.error(
      'Usage: tsx scripts/migrate-article-bio-media.ts <dump|restore> [--apply]'
    )
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')

  const projectRoot = getProjectRoot()
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

  const STRAPI_URL = process.env.STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN
  if (!STRAPI_URL || !STRAPI_TOKEN) {
    console.error('❌ STRAPI_URL and STRAPI_API_TOKEN must be set (.env)')
    process.exit(1)
  }

  await assertStrapiRunning(STRAPI_URL)
  const strapi = createStrapiClient({
    baseUrl: STRAPI_URL,
    token: STRAPI_TOKEN,
    dryRun: false
  })

  if (mode === 'dump') {
    await dump(strapi, apply)
  } else {
    await restore(strapi, apply)
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
