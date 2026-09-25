#!/usr/bin/env node

/**
 * Redirects JSON to Strapi Sync Script
 *
 * Seeds Strapi from src/config/redirects.json: creates redirects Strapi lacks
 * and updates ones whose destination, category, type, enabled state or note
 * differ. It never
 * deletes, so an entry an editor added in Strapi survives a re-run.
 *
 * Usage:
 *   pnpm run sync:redirects:dry-run
 *   pnpm run sync:redirects
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { spawnSync } from 'child_process'
import {
  assertRunFromCms,
  getConfigPath,
  getProjectRoot,
  redirectConfigToEntries,
  type RedirectConfig,
  type RedirectEntry
} from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const API_PATH = '/api/redirects'
/** Strapi's REST maximum page size. */
const PAGE_SIZE = 100

interface StoredRedirect extends RedirectEntry {
  documentId: string
}

interface ListResponse {
  data: StoredRedirect[]
  meta: { pagination: { pageCount: number } }
}

interface SyncCounts {
  created: number
  updated: number
  unchanged: number
}

function readRedirectConfig(filepath: string): RedirectConfig {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Config file not found: ${filepath}`)
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as RedirectConfig
  } catch (error) {
    throw new Error(
      `Failed to read or parse config file: ${filepath}: ${error instanceof Error ? error.message : error}`,
      { cause: error }
    )
  }
}

function isUnchanged(stored: RedirectEntry, wanted: RedirectEntry): boolean {
  return (
    stored.destination === wanted.destination &&
    stored.category === wanted.category &&
    (stored.redirectType ?? 'permanent') === wanted.redirectType &&
    // Strict, not isRedirectEnabled: a null left from before the field existed
    // shows as off in the admin, so the seed backfills it to true.
    stored.enabled === wanted.enabled &&
    (stored.note ?? null) === wanted.note
  )
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    // One commit per seeded row would be hundreds of commits; the file this
    // reads from is already the one the lifecycle would write.
    'x-skip-mdx-export': 'true'
  }
}

async function fetchStoredRedirects(
  baseUrl: string,
  token: string
): Promise<Map<string, StoredRedirect>> {
  const stored = new Map<string, StoredRedirect>()
  for (let page = 1; ; page++) {
    const url = `${baseUrl}${API_PATH}?pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`
    const res = await fetch(url, { headers: buildHeaders(token) })
    if (!res.ok) {
      throw new Error(
        `Failed to list redirects: ${res.status} - ${await res.text()}`
      )
    }
    const body = (await res.json()) as ListResponse
    for (const entry of body.data) stored.set(entry.source, entry)
    if (page >= body.meta.pagination.pageCount) return stored
  }
}

async function writeRedirect(
  baseUrl: string,
  token: string,
  entry: RedirectEntry,
  documentId?: string
): Promise<void> {
  const url = documentId
    ? `${baseUrl}${API_PATH}/${documentId}`
    : `${baseUrl}${API_PATH}`
  const res = await fetch(url, {
    method: documentId ? 'PUT' : 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ data: entry })
  })
  if (!res.ok) {
    throw new Error(
      `Failed to sync redirect ${entry.source}: ${res.status} - ${await res.text()}`
    )
  }
}

async function syncRedirects(
  entries: RedirectEntry[],
  stored: Map<string, StoredRedirect>,
  baseUrl: string,
  token: string
): Promise<SyncCounts> {
  const counts: SyncCounts = { created: 0, updated: 0, unchanged: 0 }
  for (const entry of entries) {
    const existing = stored.get(entry.source)
    if (existing && isUnchanged(existing, entry)) {
      counts.unchanged++
      continue
    }
    const action = existing ? 'update' : 'create'
    if (DRY_RUN) {
      console.log(
        `🔍 [DRY-RUN] Would ${action} ${entry.source} → ${entry.destination}`
      )
    } else {
      await writeRedirect(baseUrl, token, entry, existing?.documentId)
    }
    counts[existing ? 'updated' : 'created']++
  }
  return counts
}

function assertAllowedBranch(projectRoot: string): void {
  if (DRY_RUN || FORCE) return
  const branch = spawnSync('git', ['branch', '--show-current'], {
    encoding: 'utf-8',
    cwd: projectRoot
  })
  const currentBranch = branch.stdout?.trim()
  const allowedBranches = ['main', 'staging']
  if (allowedBranches.includes(currentBranch || '')) return
  console.error(
    `❌ Error: sync-redirects can only run on ${allowedBranches.join(' or ')} branch (use --dry-run to preview, --force to override)`
  )
  console.error(`   Current branch: ${currentBranch || '(unknown)'}`)
  process.exit(1)
}

async function main() {
  assertRunFromCms()
  const projectRoot = getProjectRoot()
  assertAllowedBranch(projectRoot)

  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const STRAPI_URL = process.env.STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN
  if (!STRAPI_URL) {
    console.error('❌ Error: STRAPI_URL not set')
    console.error(
      '   Add STRAPI_URL to your .env file (e.g. STRAPI_URL=http://localhost:1337)'
    )
    process.exit(1)
  }
  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN not set')
    process.exit(1)
  }

  await assertStrapiRunning(STRAPI_URL)
  const configPath = getConfigPath(projectRoot, 'redirects')
  const entries = redirectConfigToEntries(readRedirectConfig(configPath))
  if (entries instanceof Error) throw entries
  const stored = await fetchStoredRedirects(STRAPI_URL, STRAPI_TOKEN)
  const counts = await syncRedirects(entries, stored, STRAPI_URL, STRAPI_TOKEN)

  const verb = DRY_RUN ? 'Would sync' : 'Synced'
  console.log(
    `✅ ${verb} ${entries.length} redirects: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged`
  )
  if (DRY_RUN) {
    console.log(
      '\n💡 This was a dry-run. Run without --dry-run to apply changes.'
    )
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
