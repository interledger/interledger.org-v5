/**
 * Snapshot the upstream markdown of every published RFC into
 * src/data/docs/rfcs/<id>.md, which the RFC pages render from.
 *
 * Fetches everything before writing anything, so a failed request leaves the
 * snapshots untouched. Deletes snapshots whose RFC is no longer published.
 * Run with `pnpm sync:rfcs`; `.github/workflows/sync-rfcs.yml` runs it weekly.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLISHED_RFCS, RFC_SNAPSHOT_DIR } from '../src/data/docs/rfcs'
import { tryCatchAsync } from '../src/utils/shared/tryCatch'

const FETCH_TIMEOUT_MS = 30_000

type Snapshot = { id: string; markdown: string }

async function fetchMarkdown(url: string): Promise<string | Error> {
  const response = await tryCatchAsync(() =>
    fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  )
  if (response instanceof Error) return response
  if (!response.ok) {
    return new Error(`${response.status} ${response.statusText}`)
  }
  return tryCatchAsync(() => response.text())
}

async function fetchAllSnapshots(): Promise<Snapshot[] | Error> {
  const results = await Promise.all(
    PUBLISHED_RFCS.map(async ({ id, sourceRawUrl }) => ({
      id,
      sourceRawUrl,
      markdown: await fetchMarkdown(sourceRawUrl)
    }))
  )
  const failures = results.filter((result) => result.markdown instanceof Error)
  if (failures.length > 0) {
    const lines = failures.map(
      ({ sourceRawUrl, markdown }) => `  ${sourceRawUrl}: ${String(markdown)}`
    )
    return new Error(`Failed to fetch RFC markdown:\n${lines.join('\n')}`)
  }
  return results.map(({ id, markdown }) => ({ id, markdown: String(markdown) }))
}

async function writeSnapshots(snapshots: Snapshot[]): Promise<void> {
  const dir = path.resolve(RFC_SNAPSHOT_DIR)
  await fs.mkdir(dir, { recursive: true })

  const keep = new Set(snapshots.map(({ id }) => `${id}.md`))
  for (const file of await fs.readdir(dir)) {
    if (file.endsWith('.md') && !keep.has(file)) {
      await fs.rm(path.join(dir, file))
      console.log(`🗑️  Removed ${file}: no longer published`)
    }
  }

  for (const { id, markdown } of snapshots) {
    await fs.writeFile(path.join(dir, `${id}.md`), markdown)
  }
  console.log(
    `✅ Wrote ${snapshots.length} RFC snapshots to ${RFC_SNAPSHOT_DIR}`
  )
}

const snapshots = await fetchAllSnapshots()
if (snapshots instanceof Error) {
  console.error(`❌ ${snapshots.message}`)
  process.exit(1)
}
await writeSnapshots(snapshots)
