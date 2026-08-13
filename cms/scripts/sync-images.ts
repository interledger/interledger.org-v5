/**
 * Sync seedable media from public/uploads/img/original/ and public/img/ into
 * Strapi's media library. Disk files not registered in Strapi are seeded via
 * POST /api/seed-media (seedUploadsFromDisk server-side — DB records only,
 * preserves git-committed filenames as URLs).
 *
 * Extension allowlist matches seedUploadsFromDisk (SEEDABLE_EXTENSIONS):
 * images, video, and PDF.
 *
 * Usage:
 *   cd cms && pnpm run sync:images              # check + seed missing
 *   cd cms && pnpm run sync:images --dry-run     # report only, no seeding
 *
 * Requires STRAPI_URL and STRAPI_API_TOKEN in ../.env
 */

import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import {
  getProjectRoot,
  IMAGE_EXTENSIONS,
  PATHS,
  SEEDABLE_EXTENSIONS,
  validateImageFileSize
} from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'

config({ path: path.resolve(process.cwd(), '../.env'), quiet: true })

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337'
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN ?? ''
const DRY_RUN = process.argv.includes('--dry-run')

const SCAN_DIRS: ReadonlyArray<{ dir: string; urlPrefix: string }> = [
  { dir: PATHS.UPLOADS, urlPrefix: `/${PATHS.UPLOADS.replace('public/', '')}` },
  { dir: 'public/img', urlPrefix: '/img' }
]
const EXCLUDED_DIR_NAMES = new Set(['optimized'])

async function strapiGet<T>(endpoint: string): Promise<T> {
  const url = `${STRAPI_URL}/api/${endpoint}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strapi ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function strapiPost<T>(endpoint: string): Promise<T> {
  const url = `${STRAPI_URL}/api/${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strapi ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

interface UploadRecord {
  id: number
  url: string
}

async function findByUrl(url: string): Promise<UploadRecord | null> {
  const files = await strapiGet<UploadRecord[]>(
    `upload/files?filters[url][$eq]=${encodeURIComponent(url)}`
  )
  return files.length > 0 ? files[0] : null
}

function collectSeedableFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name)) continue
        walk(full)
      } else if (
        SEEDABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        results.push(full)
      }
    }
  }

  walk(dir)
  return results
}

async function main() {
  if (!STRAPI_TOKEN) {
    console.error('❌ STRAPI_API_TOKEN is required. Set it in .env')
    process.exit(1)
  }
  await assertStrapiRunning(STRAPI_URL)

  if (DRY_RUN) console.log('ℹ️  Dry run — no media will be seeded\n')

  const projectRoot = getProjectRoot()
  let totalRegistered = 0
  let totalMissing = 0
  let totalFailed = 0
  let totalOversized = 0

  for (const { dir, urlPrefix } of SCAN_DIRS) {
    const absDir = path.join(projectRoot, dir)
    console.log(`\n📁 Scanning: ${absDir}`)

    const files = collectSeedableFiles(absDir)
    if (files.length === 0) {
      console.log('   No seedable media files found.')
      continue
    }

    console.log(`   Found ${files.length} seedable file(s)\n`)

    for (const filePath of files) {
      const relativePath = path.relative(absDir, filePath)
      const expectedUrl = `${urlPrefix}/${relativePath.replace(/\\/g, '/')}`
      const ext = path.extname(filePath).toLowerCase()

      // Match seedUploadsFromDisk: only enforce the image size ceiling here.
      if (IMAGE_EXTENSIONS.has(ext)) {
        const sizeError = validateImageFileSize(filePath)
        if (sizeError) {
          console.log(`  ⚠️  Oversized: ${expectedUrl}`)
          console.log(`      ${sizeError.message}`)
          totalOversized++
          continue
        }
      }

      try {
        const existing = await findByUrl(expectedUrl)
        if (existing) {
          console.log(`  ✅ ${expectedUrl} (id: ${existing.id})`)
          totalRegistered++
        } else {
          console.log(
            `  ➕ ${expectedUrl} (${DRY_RUN ? 'not in Strapi — would seed' : 'not in Strapi — will seed'})`
          )
          totalMissing++
        }
      } catch (err) {
        console.error(
          `  ❌ Error: ${expectedUrl}:`,
          err instanceof Error ? err.message : err
        )
        totalFailed++
      }
    }
  }

  let totalSeeded = 0
  if (!DRY_RUN && totalMissing > 0) {
    console.log('\n⬆️  Seeding missing media library records...')
    try {
      const result = await strapiPost<{ seeded: number }>('seed-media')
      totalSeeded = result.seeded
      console.log(`✅ Seeded ${totalSeeded} media record(s)`)
    } catch (err) {
      console.error(
        '❌ Seeding failed:',
        err instanceof Error ? err.message : err
      )
      totalFailed++
    }
  }

  const summaryParts = [
    `${totalRegistered} registered`,
    ...(!DRY_RUN && totalMissing > 0 ? [`${totalSeeded} seeded`] : []),
    ...(DRY_RUN && totalMissing > 0 ? [`${totalMissing} would seed`] : []),
    ...(totalOversized > 0 ? [`${totalOversized} oversized`] : []),
    ...(totalFailed > 0 ? [`${totalFailed} errors`] : [])
  ]
  console.log(`\nSummary: ${summaryParts.join(', ')}`)

  if (DRY_RUN && totalMissing > 0) {
    console.log(
      '\n💡 Run sync:images without --dry-run to seed these media records.'
    )
  }

  if (totalFailed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(
    '❌ Fatal error:',
    err instanceof Error ? err.message : String(err)
  )
  process.exit(1)
})
