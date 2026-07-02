import type { Snapshot } from '@/types/roadmap'
import { tryCatchAsync } from '../../shared/tryCatch'

// Dev-only snapshot source for /developers/roadmap. Plain `astro dev` has no
// Netlify Blobs runtime, so the page can't read the production snapshot; this
// fetches live Linear data when a key is configured and otherwise serves the
// bundled fixture. Works under both `pnpm start` and `netlify dev`.

// Re-fetch Linear at most once per window. The in-memory memo covers repeat
// requests within one module instance; the on-disk cache bridges across HMR /
// module reloads so a code edit doesn't force a fresh fetch on the next load.
const DEV_CACHE_TTL_MS = 10 * 60 * 1000
const DEV_CACHE_FILENAME = 'ilf-roadmap-dev-snapshot.json'

let memo: Snapshot | undefined

async function devCachePath(): Promise<string> {
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  return join(tmpdir(), DEV_CACHE_FILENAME)
}

// A missing, stale, or corrupt cache is not an error here — it just means we
// fetch fresh, so all those cases collapse to null.
async function readDiskCache(): Promise<Snapshot | null> {
  const result = await tryCatchAsync(async () => {
    const { readFile, stat } = await import('node:fs/promises')
    const path = await devCachePath()
    const ageMs = Date.now() - (await stat(path)).mtimeMs
    if (ageMs > DEV_CACHE_TTL_MS) return null
    return JSON.parse(await readFile(path, 'utf8')) as Snapshot
  })
  return result instanceof Error ? null : result
}

async function writeDiskCache(snapshot: Snapshot): Promise<void> {
  // Best-effort: a failed write just means the next load re-fetches.
  await tryCatchAsync(async () => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(await devCachePath(), JSON.stringify(snapshot), 'utf8')
  })
}

async function loadFixture(): Promise<Snapshot> {
  const { ROADMAP_FIXTURE } = await import('@/data/roadmap/fixture')
  return ROADMAP_FIXTURE
}

export async function loadDevSnapshot(): Promise<Snapshot> {
  if (memo) return memo

  // `netlify dev` injects .env into process.env; plain `astro dev` only exposes
  // it via import.meta.env. Read both so live data works under either command.
  const apiKey = process.env.LINEAR_API_KEY || import.meta.env.LINEAR_API_KEY
  if (!apiKey) return loadFixture()
  // build-snapshot's Linear client reads the key from process.env at import
  // time (src/linear/env.ts), so bridge the astro dev value across first.
  process.env.LINEAR_API_KEY = apiKey

  const cached = await readDiskCache()
  if (cached) {
    memo = cached
    return cached
  }

  const live = await tryCatchAsync(async () => {
    const { buildSnapshot } = await import('@/linear/build-snapshot')
    return buildSnapshot()
  })
  if (live instanceof Error) {
    console.warn('[roadmap] dev: live Linear fetch failed, using fixture', live)
    return loadFixture()
  }

  memo = live
  await writeDiskCache(live)
  return live
}
