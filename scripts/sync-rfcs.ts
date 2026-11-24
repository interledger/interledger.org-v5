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
const MAX_FETCH_ATTEMPTS = 3
/** Doubles after each failed attempt: 2s, then 4s. */
const RETRY_BASE_DELAY_MS = 2_000
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR_MIN = 500

type Snapshot = { id: string; markdown: string }

type FetchAttempt = { markdown: string } | { error: Error; retryable: boolean }

/** A network failure, timeout, 429 or 5xx may pass; a 404 never will. */
function isRetryableStatus(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN
}

async function fetchMarkdownOnce(url: string): Promise<FetchAttempt> {
  const response = await tryCatchAsync(() =>
    fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  )
  if (response instanceof Error) return { error: response, retryable: true }
  if (!response.ok) {
    return {
      error: new Error(`${response.status} ${response.statusText}`),
      retryable: isRetryableStatus(response.status)
    }
  }
  const markdown = await tryCatchAsync(() => response.text())
  if (markdown instanceof Error) return { error: markdown, retryable: true }
  return { markdown }
}

/**
 * GitHub's raw CDN answers transient 503s under load (INTORG-1465), so a
 * failed fetch is retried with backoff before the whole sync gives up.
 */
async function fetchMarkdown(url: string): Promise<string | Error> {
  for (let attempt = 1; ; attempt++) {
    const result = await fetchMarkdownOnce(url)
    if ('markdown' in result) return result.markdown
    if (!result.retryable || attempt >= MAX_FETCH_ATTEMPTS) {
      return new Error(`${result.error.message} (attempt ${attempt})`)
    }
    const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
    console.warn(
      `⚠️  ${url}: ${result.error.message}, retrying in ${delayMs}ms`
    )
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
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
