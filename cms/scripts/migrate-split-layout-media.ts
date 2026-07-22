#!/usr/bin/env node

/**
 * Migrate existing `blocks.split-layout` entries to the new `shared.localized-media`
 * shape (nested `media: { image, alternativeText }` instead of a flat `image` field
 * whose alt text lived on the Strapi upload's global, non-localized alternativeText).
 *
 * Deploying the new `blocks.split-layout` schema (media component field replacing the
 * flat `image` attribute) makes Strapi drop the old relation on restart — so the old
 * data must be captured *before* the schema change, and written back *after* it, in
 * two separate runs:
 *
 *   1. Before deploying the new schema:
 *        pnpm --dir cms tsx scripts/migrate-split-layout-media.ts dump
 *      Reads every `blocks.split-layout` instance (across all locales, in
 *      grant-pages / grant-overview-pages) and writes its old `image` upload ID to a
 *      JSON backup file, along with the upload's current native alternativeText
 *      (used to seed `media.alternativeText`, since this component never had its own
 *      alt field before).
 *
 *   2. Deploy the new schema (restart Strapi so it picks up `split-layout.json`
 *      and `localized-media.json`).
 *
 *   3. After the schema is live:
 *        pnpm --dir cms tsx scripts/migrate-split-layout-media.ts restore
 *      Reads the backup file and PUTs each entry's `content` zone back with the
 *      `split-layout` blocks rewritten into the new `media` shape.
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

const CONTENT_TYPES = ['grant-pages', 'grant-overview-pages'] as const

const BACKUP_PATH = path.resolve(
  __dirname,
  '../.split-layout-media-migration-backup.json'
)

interface OldSplitLayoutBlock {
  apiId: (typeof CONTENT_TYPES)[number]
  documentId: string
  locale: string
  blockIndex: number
  image: number | null
  alternativeText: string | null
}

type ContentBlock = {
  __component?: string
  image?: number | { id?: number; alternativeText?: string } | null
  media?: { image: number | null; alternativeText: string }
  [key: string]: unknown
}

function withContent(entry: StrapiEntry): ContentBlock[] {
  return Array.isArray(entry.content) ? (entry.content as ContentBlock[]) : []
}

function imageId(image: ContentBlock['image']): number | null {
  if (image == null) return null
  return typeof image === 'number' ? image : (image.id ?? null)
}

function imageAlt(image: ContentBlock['image']): string | null {
  return typeof image === 'object' && image
    ? (image.alternativeText ?? null)
    : null
}

async function dump(
  strapi: ReturnType<typeof createStrapiClient>,
  apply: boolean
) {
  const found: OldSplitLayoutBlock[] = []

  for (const apiId of CONTENT_TYPES) {
    const entries = await strapi.request(
      `${apiId}?locale=all&pagination[pageSize]=100&populate[content][populate]=*`
    )
    if (entries instanceof Error) throw entries
    const data = (entries as { data?: StrapiEntry[] }).data ?? []

    for (const entry of data) {
      withContent(entry).forEach((block, blockIndex) => {
        if (block.__component !== 'blocks.split-layout') return
        if (block.image == null) return // video-layout blocks have no image
        found.push({
          apiId,
          documentId: entry.documentId,
          locale: entry.locale ?? 'en',
          blockIndex,
          image: imageId(block.image),
          alternativeText: imageAlt(block.image)
        })
      })
    }
  }

  console.log(`Found ${found.length} blocks.split-layout image instance(s).`)

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
  const backup: OldSplitLayoutBlock[] = JSON.parse(
    fs.readFileSync(BACKUP_PATH, 'utf-8')
  )

  const byEntry = new Map<string, OldSplitLayoutBlock[]>()
  for (const row of backup) {
    const key = `${row.apiId}::${row.documentId}::${row.locale}`
    const bucket = byEntry.get(key) ?? []
    bucket.push(row)
    byEntry.set(key, bucket)
  }

  let updated = 0
  let skipped = 0

  for (const [key, rows] of byEntry) {
    const [apiId, documentId, locale] = key.split('::') as [
      (typeof CONTENT_TYPES)[number],
      string,
      string
    ]

    const current = await strapi.request(
      `${apiId}/${documentId}?locale=${locale}&populate[content][populate]=*`
    )
    if (current instanceof Error) throw current
    const entry = (current as { data?: StrapiEntry }).data
    if (!entry) {
      console.warn(`⏭️  ${key} — entry no longer exists, skipping`)
      skipped++
      continue
    }

    const content = withContent(entry)
    let changed = false

    for (const row of rows) {
      const block = content[row.blockIndex]
      if (!block || block.__component !== 'blocks.split-layout') {
        console.warn(
          `⏭️  ${key} block #${row.blockIndex} — no longer a split-layout, skipping`
        )
        skipped++
        continue
      }
      if (block.media) continue // already migrated

      block.media = {
        image: row.image,
        alternativeText: row.alternativeText ?? ''
      }
      delete block.image
      changed = true
    }

    if (!changed) continue

    if (!apply) {
      console.log(`🔍 ${key} — would update ${rows.length} block(s)`)
      updated++
      continue
    }

    const result = await strapi.updateEntry(
      apiId,
      documentId,
      { content },
      locale
    )
    if (result instanceof Error) throw result
    console.log(`✅ ${key} — updated ${rows.length} block(s)`)
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
      'Usage: tsx scripts/migrate-split-layout-media.ts <dump|restore> [--apply]'
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
