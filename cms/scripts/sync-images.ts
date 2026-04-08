#!/usr/bin/env node
/**
 * Regenerate Strapi image derivatives from git-tracked originals.
 *
 * Run from cms/ with Strapi running:
 *   pnpm sync:images --dry-run
 *   pnpm sync:images
 *
 * Flow (admin uploads also copy masters to img/original/; this script bulk re-imports):
 * 1. Recursively walk public/uploads/img/original/; filenames are the slugged basename only
 *    (e.g. blog/hero.jpg → storageName hero.jpg). Delete **all** Strapi media rows with that
 *    `name` (optional; default on) so DB + disk stay aligned — then POST /api/upload replaces them.
 * 2. Remove public/uploads/img/optimized/ (optional; default on).
 * 3. Upload each original via POST /api/upload; optimized derivatives go under img/optimized/.
 *
 * `--no-replace`: do **not** delete existing media; **skip upload** for names already in Strapi
 * (only imports files that are missing). Use this to avoid re-adding duplicates on every run.
 *
 * Requires .env at repo root: STRAPI_URL, STRAPI_API_TOKEN (full access to upload API).
 *
 * Caveat: Replacing media changes file ids/URLs. Entries in Strapi that pointed at old
 * uploads may need re-linking unless names/URLs match your usage. Prefer on a dev DB or
 * after coordinating content updates.
 *
 * See cms/docs/IMAGES.md
 */

import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import mime from 'mime-types'
import { getProjectRoot } from '@/utils/paths'
import {
  storageNameFromRelativeImagePath,
  originalMasterUploadsRelFromStorageName
} from '@/utils/imageLayoutPaths'
import { createStrapiClient } from './sync-mdx/strapiClient'

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.avif',
  '.tiff',
  '.tif',
  '.bmp'
])

function isImageFile(filename: string): boolean {
  return IMAGE_EXT.has(path.extname(filename).toLowerCase())
}

type OriginalEntry = { abs: string; relPosix: string }

/** Recursively collect images under original/; `relPosix` is relative to originalDir. */
async function collectOriginalImages(
  originalDir: string
): Promise<OriginalEntry[]> {
  if (!fsSync.existsSync(originalDir)) return []
  const out: OriginalEntry[] = []

  async function walk(currentAbs: string): Promise<void> {
    const entries = await fs.readdir(currentAbs, { withFileTypes: true })
    for (const e of entries) {
      if (e.name === '.gitkeep' || e.name.startsWith('.')) continue
      const abs = path.join(currentAbs, e.name)
      if (e.isDirectory()) {
        await walk(abs)
      } else if (isImageFile(e.name)) {
        const rel = path.relative(originalDir, abs)
        const relPosix = rel.split(path.sep).join('/')
        out.push({ abs, relPosix })
      }
    }
  }

  await walk(originalDir)
  out.sort((a, b) => a.relPosix.localeCompare(b.relPosix))

  // Deduplicate by canonical slug URL. Two files (e.g. a legacy subdir file and a
  // flat copy created by the upload hook) may map to the same img/original/<slug>.ext
  // target. Keep the flat root-level file when there's a collision — it's the
  // canonical form. If no flat file exists, keep whichever was found first.
  const seen = new Map<string, OriginalEntry>()
  for (const entry of out) {
    const storageName = storageNameFromRelativeImagePath(entry.relPosix)
    const canonicalUrl = originalMasterUploadsRelFromStorageName(storageName)
    const existing = seen.get(canonicalUrl)
    if (!existing) {
      seen.set(canonicalUrl, entry)
    } else {
      // Prefer the flat file (no `/` in relPosix) over a subdir file
      const entryIsFlat = !entry.relPosix.includes('/')
      if (entryIsFlat) {
        seen.set(canonicalUrl, entry)
      }
      // else keep existing
    }
  }
  return [...seen.values()].sort((a, b) => a.relPosix.localeCompare(b.relPosix))
}

async function wipeOptimized(
  optimizedDir: string,
  dryRun: boolean
): Promise<void> {
  if (!fsSync.existsSync(optimizedDir)) {
    if (!dryRun) {
      await fs.mkdir(optimizedDir, { recursive: true })
    }
    console.log(
      `📁 ${dryRun ? '[dry-run] would create' : 'created'} ${optimizedDir}`
    )
    return
  }
  if (dryRun) {
    const entries = await fs.readdir(optimizedDir)
    for (const e of entries) {
      console.log(`  [dry-run] would remove ${path.join(optimizedDir, e)}`)
    }
    return
  }
  await fs.rm(optimizedDir, { recursive: true, force: true })
  await fs.mkdir(optimizedDir, { recursive: true })
  console.log(`🗑️  Emptied and recreated ${optimizedDir}`)
}

async function uploadOriginal(args: {
  filePath: string
  storageName: string
  baseUrl: string
  token: string
  dryRun: boolean
}): Promise<{ id?: number; url?: string; documentId?: string } | null> {
  const { filePath, storageName, baseUrl, token, dryRun } = args
  const mimeType = mime.lookup(filePath) || 'application/octet-stream'

  if (dryRun) {
    console.log(`  [dry-run] would upload ${storageName} (${mimeType})`)
    return null
  }

  const buffer = await fs.readFile(filePath)
  const blob = new Blob([buffer], { type: mimeType })
  const formData = new FormData()
  formData.append('files', blob, storageName)
  formData.append(
    'fileInfo',
    JSON.stringify({
      name: storageName,
      alternativeText: null,
      caption: null
    })
  )

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-skip-mdx-export': 'true'
    },
    body: formData
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed (${res.status}): ${text}`)
  }

  const data: unknown = await res.json()
  const row = Array.isArray(data)
    ? (data as Record<string, unknown>[])[0]
    : (data as { data?: Record<string, unknown>[] })?.data?.[0]

  if (!row || typeof row !== 'object') return null
  const id =
    typeof row.id === 'number'
      ? row.id
      : typeof row.id === 'string'
        ? parseInt(row.id, 10)
        : undefined
  const url = typeof row.url === 'string' ? row.url : undefined
  const documentId =
    typeof row.documentId === 'string' ? row.documentId : undefined

  return {
    id: Number.isFinite(id) ? id : undefined,
    url,
    documentId
  }
}

async function main(): Promise<void> {
  console.log('🖼️  sync:images — originals → Strapi → optimized')
  console.log('='.repeat(50))

  const dryRun = process.argv.includes('--dry-run')
  const noWipe = process.argv.includes('--no-wipe')
  /** When set: never delete existing uploads; skip upload if that filename already exists. */
  const noReplace = process.argv.includes('--no-replace')
  const force = process.argv.includes('--force')

  const projectRoot = getProjectRoot()

  if (!dryRun && !force) {
    const branch = spawnSync('git', ['branch', '--show-current'], {
      encoding: 'utf-8',
      cwd: projectRoot
    })
    const currentBranch = branch.stdout?.trim()
    const allowed = ['main', 'staging']
    if (!allowed.includes(currentBranch || '')) {
      console.error(
        `❌ Refusing to run outside ${allowed.join('/')} (use --dry-run or --force)`
      )
      console.error(`   Current branch: ${currentBranch || '(unknown)'}`)
      process.exit(1)
    }
  }

  const envPath = path.join(projectRoot, '.env')
  if (fsSync.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const STRAPI_URL = process.env.STRAPI_URL?.replace(/\/$/, '')
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

  if (!STRAPI_URL) {
    console.error('❌ STRAPI_URL missing in .env')
    process.exit(1)
  }
  if (!STRAPI_TOKEN) {
    console.error('❌ STRAPI_API_TOKEN missing in .env')
    process.exit(1)
  }

  const originalDir = path.join(
    projectRoot,
    'public',
    'uploads',
    'img',
    'original'
  )
  const optimizedDir = path.join(
    projectRoot,
    'public',
    'uploads',
    'img',
    'optimized'
  )

  const originals = await collectOriginalImages(originalDir)
  if (originals.length === 0) {
    console.log(`No images found under ${originalDir} (recursive)`)
    process.exit(0)
  }

  console.log(`🔗 Strapi: ${STRAPI_URL}`)
  console.log(`📂 ${originals.length} image(s) under original/ (recursive)`)
  if (dryRun) console.log('🔍 DRY-RUN — no API calls that mutate data\n')

  const strapi = createStrapiClient({
    baseUrl: STRAPI_URL,
    token: STRAPI_TOKEN
  })

  // 1) Remove every Strapi row with the same media `name` (clears accidental duplicates too)
  if (!noReplace) {
    for (const { relPosix } of originals) {
      const storageName = storageNameFromRelativeImagePath(relPosix)
      if (dryRun) {
        const ids = await strapi.findUploadIdsByName(storageName)
        for (const id of ids) {
          console.log(
            `  [dry-run] would delete Strapi upload id=${id} (${storageName})`
          )
        }
        continue
      }
      const ids = await strapi.findUploadIdsByName(storageName)
      for (const id of ids) {
        await strapi.deleteUploadFile(id)
        console.log(
          `🗑️  Deleted existing Strapi media id=${id} (${storageName})`
        )
      }
    }
  }

  // 2) Wipe optimized folder on disk (orphans + clean slate)
  if (!noWipe) {
    await wipeOptimized(optimizedDir, dryRun)
  } else {
    console.log('⏭️  Skipped wiping optimized/ (--no-wipe)')
  }

  // 3) Upload each original (Strapi writes to img/optimized/ via custom provider)
  let uploaded = 0
  let failed = 0
  let skippedExisting = 0
  for (const { abs, relPosix } of originals) {
    const storageName = storageNameFromRelativeImagePath(relPosix)
    if (noReplace) {
      const existingId = await strapi.findUploadByName(storageName)
      if (existingId != null) {
        skippedExisting += 1
        const suffix = dryRun ? ' [dry-run]' : ''
        console.log(
          `⏭️  Skipping ${relPosix} (${storageName}) — already in Strapi${suffix}`
        )
        continue
      }
    }
    try {
      const result = await uploadOriginal({
        filePath: abs,
        storageName,
        baseUrl: STRAPI_URL,
        token: STRAPI_TOKEN,
        dryRun
      })
      if (!dryRun && result) {
        const idPart =
          result.id != null
            ? `id=${result.id}`
            : result.documentId
              ? `documentId=${result.documentId}`
              : 'id=?'
        console.log(
          `✅ ${relPosix} (${storageName}) → ${idPart} url=${result.url ?? '?'}`
        )
      }
      uploaded += 1
    } catch (e) {
      failed += 1
      console.error(
        `❌ ${relPosix}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  console.log('='.repeat(50))
  const summaryParts = [
    dryRun ? `${uploaded} file(s) would be uploaded` : `${uploaded} uploaded`,
    failed > 0 ? `${failed} failed` : null,
    skippedExisting > 0
      ? `${skippedExisting} skipped (already in Strapi)`
      : null
  ].filter(Boolean)
  console.log(
    dryRun
      ? `Done (dry-run). ${summaryParts.join(', ')}.`
      : `Done. ${summaryParts.join(', ')}.`
  )
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
