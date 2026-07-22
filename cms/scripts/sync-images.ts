/**
 * Check which images in public/uploads/img/original/ and public/img/ are
 * registered in Strapi's media library.
 *
 * The primary seeding mechanism lives in bootstrap (cms/src/index.ts) and runs
 * on every Strapi start. This script is for diagnostics.
 *
 * Usage:
 *   cd cms && pnpm run sync:images              # full report
 *   cd cms && pnpm run sync:images --dry-run     # same (read-only either way)
 *
 * Requires STRAPI_URL and STRAPI_API_TOKEN in ../.env
 */

import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { getProjectRoot, PATHS } from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'

config({ path: path.resolve(process.cwd(), '../.env'), quiet: true })

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337'
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN ?? ''

const SCAN_DIRS: ReadonlyArray<{ dir: string; urlPrefix: string }> = [
  { dir: PATHS.UPLOADS, urlPrefix: `/${PATHS.UPLOADS.replace('public/', '')}` },
  { dir: 'public/img', urlPrefix: '/img' }
]
const EXCLUDED_DIR_NAMES = new Set(['optimized'])

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.tiff'
])

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

function collectImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name)) continue
        walk(full)
      } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
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

  const projectRoot = getProjectRoot()
  let totalRegistered = 0
  let totalMissing = 0
  let totalFailed = 0

  for (const { dir, urlPrefix } of SCAN_DIRS) {
    const absDir = path.join(projectRoot, dir)
    console.log(`\n📁 Scanning: ${absDir}`)

    const files = collectImageFiles(absDir)
    if (files.length === 0) {
      console.log('   No image files found.')
      continue
    }

    console.log(`   Found ${files.length} image file(s)\n`)

    for (const filePath of files) {
      const relativePath = path.relative(absDir, filePath)
      const expectedUrl = `${urlPrefix}/${relativePath.replace(/\\/g, '/')}`

      try {
        const existing = await findByUrl(expectedUrl)
        if (existing) {
          console.log(`  ✅ ${expectedUrl} (id: ${existing.id})`)
          totalRegistered++
        } else {
          console.log(
            `  ❌ ${expectedUrl} (on disk, not in Strapi — restart Strapi to seed)`
          )
          totalMissing++
        }
      } catch (err) {
        console.error(
          `  ⚠️  Error: ${expectedUrl}:`,
          err instanceof Error ? err.message : err
        )
        totalFailed++
      }
    }
  }

  console.log(
    `\nSummary: ${totalRegistered} registered, ${totalMissing} missing, ${totalFailed} errors`
  )

  if (totalMissing > 0) {
    console.log(
      '\n💡 Missing files will be auto-seeded on next Strapi startup (bootstrap).'
    )
    console.log('   Or restart Strapi now: cd cms && pnpm run develop')
  }
}

main().catch((err) => {
  console.error(
    '❌ Fatal error:',
    err instanceof Error ? err.message : String(err)
  )
  process.exit(1)
})
