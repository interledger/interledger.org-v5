/**
 * Snapshot the upstream markdown of the published RFCs into
 * src/data/docs/rfcs/<id>.md, and the images they show into
 * src/data/docs/rfcs/images/, which the RFC pages render from.
 *
 * `pnpm sync:rfcs` refreshes every RFC: it deletes snapshots of RFCs no longer
 * published and images no RFC shows any more. `pnpm sync:rfcs -- <id> …`
 * refreshes only the RFCs named and deletes nothing, so publishing a new RFC
 * doesn't sweep unrelated upstream edits into the same PR.
 *
 * Fetches everything before writing anything, so a failed request leaves the
 * snapshots untouched. `.github/workflows/sync-rfcs.yml` runs the full sync
 * weekly.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLISHED_RFCS,
  RFC_IMAGE_DIR,
  RFC_IMAGE_EXTENSIONS,
  RFC_SNAPSHOT_DIR,
  type PublishedRfc
} from '../src/data/docs/rfcs'
import { collectRfcImageSources } from '../src/utils/docs/rfcImages'
import { rfcMarkdownToHtml } from '../src/utils/docs/renderRfcMarkdown'
import { tryCatchAsync } from '../src/utils/shared/tryCatch'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const FETCH_TIMEOUT_MS = 30_000
const MAX_FETCH_ATTEMPTS = 3
/** Doubles after each failed attempt: 2s, then 4s. */
const RETRY_BASE_DELAY_MS = 2_000
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR_MIN = 500

type Snapshot = { id: string; markdown: string }
type Image = { sourcePath: string; bytes: Uint8Array }
type SyncResult = { snapshots: Snapshot[]; images: Image[] }

type FetchAttempt<T> = { value: T } | { error: Error; retryable: boolean }

/** A network failure, timeout, 429 or 5xx may pass; a 404 never will. */
function isRetryableStatus(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN
}

async function fetchOnce<T>(
  url: string,
  read: (response: Response) => Promise<T>
): Promise<FetchAttempt<T>> {
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
  const value = await tryCatchAsync(() => read(response))
  if (value instanceof Error) return { error: value, retryable: true }
  return { value }
}

/**
 * GitHub's raw CDN answers transient 503s under load (INTORG-1465), so a
 * failed fetch is retried with backoff before the whole sync gives up.
 */
async function fetchWithRetry<T>(
  url: string,
  read: (response: Response) => Promise<T>
): Promise<T | Error> {
  for (let attempt = 1; ; attempt++) {
    const result = await fetchOnce(url, read)
    if ('value' in result) return result.value
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

const readText = (response: Response) => response.text()
const readBytes = async (response: Response) =>
  new Uint8Array(await response.arrayBuffer())

/** The RFCs named on the command line, or every published RFC if none. */
function selectRfcs(ids: string[]): readonly PublishedRfc[] | Error {
  if (ids.length === 0) return PUBLISHED_RFCS
  const unknown = ids.filter(
    (id) => !PUBLISHED_RFCS.some((rfc) => rfc.id === id)
  )
  if (unknown.length > 0) {
    return new Error(
      `Not in PUBLISHED_RFCS: ${unknown.join(', ')}. Add the RFC there first.`
    )
  }
  return PUBLISHED_RFCS.filter((rfc) => ids.includes(rfc.id))
}

function hasAllowedImageExtension(sourcePath: string): boolean {
  const extension = path.extname(sourcePath).toLowerCase()
  return RFC_IMAGE_EXTENSIONS.some((allowed) => allowed === extension)
}

async function fetchSnapshots(
  rfcs: readonly PublishedRfc[]
): Promise<Snapshot[] | Error> {
  const results = await Promise.all(
    rfcs.map(async ({ id, sourceRawUrl }) => ({
      id,
      sourceRawUrl,
      markdown: await fetchWithRetry(sourceRawUrl, readText)
    }))
  )
  const snapshots: Snapshot[] = []
  const failures: string[] = []
  for (const { id, sourceRawUrl, markdown } of results) {
    if (markdown instanceof Error) {
      failures.push(`  ${sourceRawUrl}: ${markdown.message}`)
    } else {
      snapshots.push({ id, markdown })
    }
  }
  if (failures.length > 0) {
    return new Error(`Failed to fetch RFC markdown:\n${failures.join('\n')}`)
  }
  return snapshots
}

/** Every interledger/rfcs image the snapshots show, fetched once each. */
async function fetchImages(
  rfcs: readonly PublishedRfc[],
  snapshots: Snapshot[]
): Promise<Image[] | Error> {
  const sources = new Map<string, string>()
  for (const { id, markdown } of snapshots) {
    const rfc = rfcs.find((entry) => entry.id === id)
    if (!rfc) continue
    const html = rfcMarkdownToHtml(markdown)
    for (const image of collectRfcImageSources(html, rfc.sourceRawUrl)) {
      sources.set(image.sourcePath, image.downloadUrl)
    }
  }

  const unsupported = [...sources.keys()].filter(
    (sourcePath) => !hasAllowedImageExtension(sourcePath)
  )
  if (unsupported.length > 0) {
    return new Error(
      `RFC image type not in RFC_IMAGE_EXTENSIONS: ${unsupported.join(', ')}`
    )
  }

  const results = await Promise.all(
    [...sources].map(async ([sourcePath, downloadUrl]) => ({
      sourcePath,
      downloadUrl,
      bytes: await fetchWithRetry(downloadUrl, readBytes)
    }))
  )
  const images: Image[] = []
  const failures: string[] = []
  for (const { sourcePath, downloadUrl, bytes } of results) {
    if (bytes instanceof Error) {
      failures.push(`  ${downloadUrl}: ${bytes.message}`)
    } else {
      images.push({ sourcePath, bytes })
    }
  }
  if (failures.length > 0) {
    return new Error(`Failed to fetch RFC images:\n${failures.join('\n')}`)
  }
  return images
}

async function fetchAll(
  rfcs: readonly PublishedRfc[]
): Promise<SyncResult | Error> {
  const snapshots = await fetchSnapshots(rfcs)
  if (snapshots instanceof Error) return snapshots
  const images = await fetchImages(rfcs, snapshots)
  if (images instanceof Error) return images
  return { snapshots, images }
}

/** Snapshots of RFCs no longer published, and every old image, are removed. */
async function removeStaleFiles(
  snapshotDir: string,
  snapshots: Snapshot[]
): Promise<void> {
  const keep = new Set(snapshots.map(({ id }) => `${id}.md`))
  for (const file of await fs.readdir(snapshotDir)) {
    if (file.endsWith('.md') && !keep.has(file)) {
      await fs.rm(path.join(snapshotDir, file))
      console.log(`🗑️  Removed ${file}: no longer published`)
    }
  }
  // Rewritten in full below, so an image no RFC shows any more disappears.
  await fs.rm(path.join(REPO_ROOT, RFC_IMAGE_DIR), {
    recursive: true,
    force: true
  })
}

async function writeSyncResult(
  { snapshots, images }: SyncResult,
  { full }: { full: boolean }
): Promise<void> {
  // Against the repo root, not the CWD, so running the script from another
  // directory can't write a stray snapshot tree there.
  const snapshotDir = path.join(REPO_ROOT, RFC_SNAPSHOT_DIR)
  await fs.mkdir(snapshotDir, { recursive: true })
  if (full) await removeStaleFiles(snapshotDir, snapshots)

  for (const { id, markdown } of snapshots) {
    await fs.writeFile(path.join(snapshotDir, `${id}.md`), markdown)
  }
  for (const { sourcePath, bytes } of images) {
    const file = path.join(REPO_ROOT, RFC_IMAGE_DIR, sourcePath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, bytes)
  }
  console.log(
    `✅ Wrote ${snapshots.length} RFC snapshot(s) and ${images.length} image(s) to ${RFC_SNAPSHOT_DIR}`
  )
}

// pnpm forwards a literal `--` on some versions; it is never an RFC id.
const requestedIds = process.argv.slice(2).filter((arg) => arg !== '--')
const rfcs = selectRfcs(requestedIds)
if (rfcs instanceof Error) {
  console.error(`❌ ${rfcs.message}`)
  process.exit(1)
}
const result = await fetchAll(rfcs)
if (result instanceof Error) {
  console.error(`❌ ${result.message}`)
  process.exit(1)
}
await writeSyncResult(result, { full: requestedIds.length === 0 })
