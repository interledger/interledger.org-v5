#!/usr/bin/env node

/**
 * Migrate existing `profile-page` entries to the new `shared.localized-media`
 * shape: the flat `photo` media field becomes a nested
 * `media: { image, alternativeText }` component.
 *
 * Deploying the new schema (media component field replacing the flat `photo`
 * attribute) makes Strapi drop the old relation on restart — so the old data
 * must be captured *before* the schema change, and written back *after* it,
 * in two separate runs:
 *
 *   1. Before deploying the new schema:
 *        pnpm --dir cms tsx scripts/migrate-profile-page-media.ts dump
 *      Reads every profile-page (across all locales) and writes its old
 *      `photo` upload ID + the upload's current native alternativeText to a
 *      JSON backup file.
 *
 *   2. Deploy the new schema (restart Strapi so it picks up
 *      `profile-page/schema.json` and `localized-media.json`).
 *
 *   3. After the schema is live:
 *        pnpm --dir cms tsx scripts/migrate-profile-page-media.ts restore
 *      Reads the backup file and PUTs each profile back with `media`
 *      populated.
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

const API_ID = 'profile-pages'

const BACKUP_PATH = path.resolve(
  __dirname,
  '../.profile-page-media-migration-backup.json'
)

interface OldProfilePhoto {
  documentId: string
  locale: string
  photo: number | null
  alternativeText: string | null
}

type MediaRef = number | { id?: number; alternativeText?: string } | null

type ProfilePage = {
  photo?: MediaRef
  media?: { image: number | null; alternativeText: string }
  [key: string]: unknown
}

function imageId(image: MediaRef): number | null {
  if (image == null) return null
  return typeof image === 'number' ? image : (image.id ?? null)
}

function imageAlt(image: MediaRef): string | null {
  return typeof image === 'object' && image
    ? (image.alternativeText ?? null)
    : null
}

async function dump(
  strapi: ReturnType<typeof createStrapiClient>,
  apply: boolean
) {
  const found: OldProfilePhoto[] = []

  const entries = await strapi.request(
    `${API_ID}?locale=all&pagination[pageSize]=100&populate[photo]=true`
  )
  if (entries instanceof Error) throw entries
  const data = (entries as { data?: StrapiEntry[] }).data ?? []

  for (const entry of data) {
    const profile = entry as unknown as ProfilePage
    if (profile.photo == null) continue
    found.push({
      documentId: entry.documentId,
      locale: entry.locale ?? 'en',
      photo: imageId(profile.photo),
      alternativeText: imageAlt(profile.photo)
    })
  }

  console.log(`Found ${found.length} profile page(s) with a photo.`)

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
  const backup: OldProfilePhoto[] = JSON.parse(
    fs.readFileSync(BACKUP_PATH, 'utf-8')
  )

  let updated = 0
  let skipped = 0

  for (const row of backup) {
    const key = `${row.documentId}::${row.locale}`

    const current = await strapi.request(
      `${API_ID}/${row.documentId}?locale=${row.locale}&populate[media][populate]=*`
    )
    if (current instanceof Error) throw current
    const entry = (current as { data?: StrapiEntry }).data
    if (!entry) {
      console.warn(`⏭️  ${key} — entry no longer exists, skipping`)
      skipped++
      continue
    }
    const profile = entry as unknown as ProfilePage
    if (profile.media) continue // already migrated

    if (!apply) {
      console.log(`🔍 ${key} — would update`)
      updated++
      continue
    }

    const result = await strapi.updateEntry(
      API_ID,
      row.documentId,
      {
        media: {
          image: row.photo,
          alternativeText: row.alternativeText ?? ''
        }
      },
      row.locale
    )
    if (result instanceof Error) throw result
    console.log(`✅ ${key} — updated`)
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
      'Usage: tsx scripts/migrate-profile-page-media.ts <dump|restore> [--apply]'
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
