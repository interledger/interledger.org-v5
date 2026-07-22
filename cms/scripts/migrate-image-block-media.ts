#!/usr/bin/env node

/**
 * Migrate existing `blocks.image-block` entries to the new `shared.localized-media`
 * shape (nested `media: { image, alternativeText }` instead of flat `image`/`altText`).
 *
 * Deploying the new `blocks.image-block` schema (media component field replacing the
 * flat `image`/`altText` attributes) makes Strapi drop the old columns/relations on
 * restart — so the old data must be captured *before* the schema change, and written
 * back *after* it, in two separate runs:
 *
 *   1. Before deploying the new schema:
 *        pnpm --dir cms tsx scripts/migrate-image-block-media.ts dump
 *      Reads every `blocks.image-block` instance (across all locales, in
 *      foundation-blog-posts / grant-pages / grant-overview-pages) and writes its
 *      old `image`/`tabletImage`/`mobileImage`/`altText` values to a JSON backup file.
 *
 *   2. Deploy the new schema (restart Strapi so it picks up `image-block.json`
 *      and `localized-media.json`).
 *
 *   3. After the schema is live:
 *        pnpm --dir cms tsx scripts/migrate-image-block-media.ts restore
 *      Reads the backup file and PUTs each entry's `content` zone back with the
 *      `image-block` blocks rewritten into the new `media` shape.
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

const CONTENT_TYPES = [
  'foundation-blog-posts',
  'grant-pages',
  'grant-overview-pages'
] as const

const BACKUP_PATH = path.resolve(
  __dirname,
  '../.image-block-media-migration-backup.json'
)

interface OldImageBlock {
  apiId: (typeof CONTENT_TYPES)[number]
  documentId: string
  locale: string
  blockIndex: number
  image: number | null
  tabletImage: number | null
  mobileImage: number | null
  altText: string | null
}

type ContentBlock = {
  __component?: string
  image?: number | null
  tabletImage?: number | null
  mobileImage?: number | null
  altText?: string | null
  media?: { image: number | null; alternativeText: string }
  [key: string]: unknown
}

function withContent(entry: StrapiEntry): ContentBlock[] {
  return Array.isArray(entry.content) ? (entry.content as ContentBlock[]) : []
}

async function dump(
  strapi: ReturnType<typeof createStrapiClient>,
  apply: boolean
) {
  const found: OldImageBlock[] = []

  for (const apiId of CONTENT_TYPES) {
    const entries = await strapi.request(
      `${apiId}?locale=all&pagination[pageSize]=100&populate[content][populate]=*`
    )
    if (entries instanceof Error) throw entries
    const data = (entries as { data?: StrapiEntry[] }).data ?? []

    for (const entry of data) {
      withContent(entry).forEach((block, blockIndex) => {
        if (block.__component !== 'blocks.image-block') return
        found.push({
          apiId,
          documentId: entry.documentId,
          locale: entry.locale ?? 'en',
          blockIndex,
          image: block.image ?? null,
          tabletImage: block.tabletImage ?? null,
          mobileImage: block.mobileImage ?? null,
          altText: block.altText ?? null
        })
      })
    }
  }

  console.log(`Found ${found.length} blocks.image-block instance(s).`)

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
  const backup: OldImageBlock[] = JSON.parse(
    fs.readFileSync(BACKUP_PATH, 'utf-8')
  )

  const byEntry = new Map<string, OldImageBlock[]>()
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
      if (!block || block.__component !== 'blocks.image-block') {
        console.warn(
          `⏭️  ${key} block #${row.blockIndex} — no longer an image-block, skipping`
        )
        skipped++
        continue
      }
      if (block.media) continue // already migrated

      block.media = {
        image: row.image,
        alternativeText: row.altText ?? ''
      }
      delete block.image
      delete block.altText
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
      'Usage: tsx scripts/migrate-image-block-media.ts <dump|restore> [--apply]'
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
