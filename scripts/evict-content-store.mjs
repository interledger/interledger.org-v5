#!/usr/bin/env node
/**
 * Removes Astro's content store before a production build.
 *
 * Astro keeps the store in `node_modules/.astro/data-store.json` and derives
 * each entry id from the lowercased filename. A content file renamed in case
 * only therefore keeps its id, so the incremental sync refreshes the entry but
 * holds on to the old `filePath` and emits it as an import specifier. A
 * case-insensitive filesystem resolves that stale path, so the build passes on
 * macOS and fails on Linux — in CI, or on Netlify, which restores
 * `node_modules` from its build cache (INTORG-1237).
 *
 * Dropping the store costs nothing here. Every collection is file-based, so
 * the glob loader re-reads the frontmatter either way: a cold sync and a warm
 * one both measure about 0.4s on the full site.
 *
 * `astro dev` never runs `prebuild`, so local development keeps its store.
 *
 * Usage: node scripts/evict-content-store.mjs
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const STORE_DIR = join('node_modules', '.astro')

try {
  rmSync(STORE_DIR, { recursive: true, force: true })
  console.log(
    `[evict-content-store] Removed ${STORE_DIR}; content re-syncs from disk.`
  )
} catch (error) {
  // Never fail the build over a cache the build can rebuild. A stale store
  // only breaks a case-only rename, whereas aborting here breaks every deploy.
  console.warn(
    `[evict-content-store] Could not remove ${STORE_DIR}: ${error.message}`
  )
}
