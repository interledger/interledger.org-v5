#!/usr/bin/env node
/**
 * Delete every entry in one or more Strapi collection types.
 *
 * Strapi 5 + i18n: listing with `locale=all` is not always complete; this script
 * merges `locale=all` plus each configured locale. Deletes each locale variant
 * (`DELETE ...?locale=`) then removes the document root (`DELETE .../:documentId`).
 *
 * Run from cms/ with .env at repo root:
 *   STRAPI_URL, STRAPI_API_TOKEN
 *
 * Usage:
 *   pnpm run sync:delete-all -- --dry-run              Preview only
 *   pnpm run sync:delete-all -- --confirm              Delete all (default collections)
 *   pnpm run sync:delete-all -- --confirm foundation-pages
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { getProjectRoot, LOCALES } from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'
import {
  createStrapiClient,
  type StrapiClient,
  type StrapiEntry
} from './sync-mdx/strapiClient'

/** REST plural API ids — matches sync-mdx */
const DEFAULT_COLLECTIONS = [
  'profile-pages',
  'foundation-pages',
  'summit-pages',
  'foundation-blog-posts'
] as const

function parseArgs(argv: string[]): {
  dryRun: boolean
  confirm: boolean
  collections: string[]
} {
  const dryRun = argv.includes('--dry-run')
  const confirm = argv.includes('--confirm')
  const collectionIds = argv.filter((a) => !a.startsWith('--'))
  return {
    dryRun,
    confirm,
    collections:
      collectionIds.length > 0 ? collectionIds : [...DEFAULT_COLLECTIONS]
  }
}

/** Dedupe by document + locale; merge `locale=all` and per-locale lists. */
async function fetchAllRowsMerged(
  strapi: StrapiClient,
  apiId: string
): Promise<StrapiEntry[]> {
  const seen = new Set<string>()
  const out: StrapiEntry[] = []

  function addBatch(batch: StrapiEntry[]) {
    for (const e of batch) {
      const docId = e.documentId
      if (!docId || typeof docId !== 'string') continue
      const loc =
        typeof e.locale === 'string' && e.locale !== '' ? e.locale : 'en'
      const key = `${docId}\0${loc}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
  }

  try {
    addBatch(await strapi.getAllEntries(apiId, 'all'))
  } catch {
    // e.g. locale=all not supported
  }

  for (const loc of LOCALES) {
    try {
      addBatch(await strapi.getAllEntries(apiId, loc))
    } catch {
      // locale may be disabled for this project
    }
  }

  return out
}

/** Non-default locales first (assumes `en` is default), then `en`. */
function sortLocalesForDelete(locales: Set<string>): string[] {
  return [...locales].sort((a, b) => {
    if (a === 'en' && b !== 'en') return 1
    if (b === 'en' && a !== 'en') return -1
    return a.localeCompare(b)
  })
}

function isNotFoundError(message: string): boolean {
  return /\b404\b/.test(message) || /not\s*found/i.test(message)
}

/** Remove every locale row, then the document (404 on last step is OK). */
async function deleteDocumentAndLocales(
  strapi: StrapiClient,
  apiId: string,
  documentId: string,
  locales: Set<string>
): Promise<void> {
  for (const loc of sortLocalesForDelete(locales)) {
    try {
      await strapi.deleteLocalization(apiId, documentId, loc)
    } catch (e) {
      const msg = (e as Error).message
      if (!isNotFoundError(msg)) {
        throw e
      }
    }
  }

  try {
    await strapi.deleteEntry(apiId, documentId)
  } catch (e) {
    const msg = (e as Error).message
    if (!isNotFoundError(msg)) {
      throw e
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage:
  pnpm run sync:delete-all -- --dry-run              List what would be deleted
  pnpm run sync:delete-all -- --confirm              Delete all (default collections)
  pnpm run sync:delete-all -- --confirm <api-id>…    Delete only listed REST plural ids

Default collections: ${DEFAULT_COLLECTIONS.join(', ')}

Destructive mode requires --confirm (omit for --dry-run only).
`)
    process.exit(0)
  }

  const { dryRun, confirm, collections } = parseArgs(argv)

  if (!dryRun && !confirm) {
    console.error(`Refusing to delete: pass --dry-run to preview, or --confirm to delete.

  pnpm run sync:delete-all -- --dry-run
  pnpm run sync:delete-all -- --confirm
  pnpm run sync:delete-all -- --confirm foundation-pages

Default collections: ${DEFAULT_COLLECTIONS.join(', ')}
`)
    process.exit(1)
  }

  const projectRoot = getProjectRoot()
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const baseUrl = process.env.STRAPI_URL
  const token = process.env.STRAPI_API_TOKEN
  if (!baseUrl || !token) {
    console.error('Set STRAPI_URL and STRAPI_API_TOKEN (repo root .env).')
    process.exit(1)
  }

  await assertStrapiRunning(baseUrl)
  const strapi = createStrapiClient({ baseUrl, token })

  if (dryRun) {
    console.log('Dry-run (no deletes).\n')
  } else {
    console.log('Deleting Strapi documents…\n')
  }

  for (const apiId of collections) {
    let entries: StrapiEntry[]
    try {
      entries = await fetchAllRowsMerged(strapi, apiId)
    } catch (e) {
      console.error(`❌ ${apiId}: ${(e as Error).message}`)
      continue
    }

    const byDocument = new Map<string, Set<string>>()
    for (const e of entries) {
      const id = e.documentId
      if (!id) continue
      const loc =
        typeof e.locale === 'string' && e.locale !== '' ? e.locale : 'en'
      if (!byDocument.has(id)) byDocument.set(id, new Set())
      byDocument.get(id)!.add(loc)
    }

    console.log(
      `${apiId}: ${entries.length} row(s) merged, ${byDocument.size} document(s)`
    )

    for (const [documentId, locales] of byDocument) {
      const locStr = [...locales].sort().join(', ')
      if (dryRun) {
        console.log(`  - would delete ${documentId} (locales: ${locStr})`)
        continue
      }
      try {
        await deleteDocumentAndLocales(strapi, apiId, documentId, locales)
        console.log(`  ✓ deleted ${documentId} (${locStr})`)
      } catch (e) {
        console.error(`  ✗ ${documentId}: ${(e as Error).message}`)
      }
    }
  }

  console.log(dryRun ? '\nDone (dry-run).' : '\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
