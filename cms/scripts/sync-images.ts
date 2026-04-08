/**
 * Check which images in public/uploads/img/original/ are registered in Strapi's
 * media library. Optionally uploads unregistered files via the Strapi API.
 *
 * The primary seeding mechanism lives in bootstrap (cms/src/index.ts) and runs
 * on every Strapi start. This script is for diagnostics and manual imports.
 *
 * Usage:
 *   cd cms && pnpm run sync:images              # report + import missing
 *   cd cms && pnpm run sync:images --dry-run     # report only
 *
 * Requires STRAPI_URL and STRAPI_API_TOKEN in ../.env
 */

import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { getProjectRoot, PATHS } from '../src/utils/paths'

config({ path: path.resolve(process.cwd(), '../.env') })

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337'
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN ?? ''
const DRY_RUN = process.argv.includes('--dry-run')

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif', '.tiff'
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

  const projectRoot = getProjectRoot()
  const uploadsDir = path.join(projectRoot, PATHS.UPLOADS)

  console.log(`📁 Scanning: ${uploadsDir}`)
  if (DRY_RUN) console.log('🏜️  Dry run — no changes will be made\n')

  const files = collectImageFiles(uploadsDir)
  if (files.length === 0) {
    console.log('No image files found.')
    return
  }

  console.log(`Found ${files.length} image file(s)\n`)

  let registered = 0
  let missing = 0
  let failed = 0

  for (const filePath of files) {
    const publicDir = path.join(projectRoot, 'public')
    const relativePath = path.relative(publicDir, filePath)
    const expectedUrl = `/${relativePath.replace(/\\/g, '/')}`

    try {
      const existing = await findByUrl(expectedUrl)
      if (existing) {
        console.log(`  ✅ Registered: ${expectedUrl} (id: ${existing.id})`)
        registered++
      } else {
        console.log(`  ❌ Missing:    ${expectedUrl}`)
        missing++
      }
    } catch (err) {
      console.error(
        `  ⚠️  Error checking ${expectedUrl}:`,
        err instanceof Error ? err.message : err
      )
      failed++
    }
  }

  console.log(
    `\nSummary: ${registered} registered, ${missing} missing, ${failed} errors`
  )

  if (missing > 0) {
    console.log(
      '\n💡 Missing files will be auto-seeded on next Strapi startup (bootstrap).'
    )
    console.log(
      '   Or restart Strapi now: cd cms && pnpm run develop'
    )
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
