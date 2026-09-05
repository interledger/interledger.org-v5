import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { PATHS, getProjectRoot } from './paths'
import { tryCatchAsync } from './tryCatch'
import {
  isSlackAlertingConfigured,
  notifyGitSyncToSlack,
  type GitSyncAlert,
  type NotifyGitSync
} from './slackNotify'

// These constants come from PATHS. This file does not keep a second copy of
// the layout. The trailing slash is important. Each constant works as a
// `startsWith` prefix. Without the slash, `src/content` would also match
// `src/contentious/`.
const CONTENT_DIR = `${PATHS.CONTENT_ROOT}/`
const DATA_DIR = `${PATHS.DATA_ROOT}/`
const UPLOADS_DIR = PATHS.UPLOADS

/** Every debounced sync stages this whole directory, if it exists. */
const STAGE_CANDIDATES = [CONTENT_DIR, DATA_DIR, UPLOADS_DIR] as const
/** Path prefixes for editorial content. The code uses them to build the commit message. */
const CONTENT_PATH_PREFIXES = [CONTENT_DIR, DATA_DIR] as const
const DEBOUNCE_MS = 300

interface GitStatusChange {
  status: string
  filepath: string
}

export interface SyncContext {
  slug?: string
  action?: 'create' | 'update' | 'delete'
  author?: { name: string; email: string }
}

// ── Results ──────────────────────────────────────────────────────────────────

/**
 * A git command exited with a non-zero code. This error keeps the raw
 * stdout and stderr streams. A push rejection and an expired token both
 * produce only a non-zero exit code, with no other signal.
 */
export class GitCommandError extends Error {
  readonly command: string
  readonly stdout: string
  readonly stderr: string

  constructor(
    command: string,
    stdout: string,
    stderr: string,
    message: string
  ) {
    super(message)
    this.name = 'GitCommandError'
    this.command = command
    this.stdout = stdout
    this.stderr = stderr
  }

  /** The combined stdout and stderr text. Git can print its message to either stream. */
  get combinedOutput(): string {
    return `${this.stdout}\n${this.stderr}`
  }
}

export type GitSyncSkipReason =
  | 'disabled'
  | 'no-changes'
  | 'no-stage-paths'
  | 'no-valid-paths'

/**
 * The result of one sync attempt. This type shows the difference between
 * a harmless no-op and a real failure. The console logs alone did not
 * show this difference.
 */
export type GitSyncResult =
  | { outcome: 'synced'; message: string }
  | { outcome: 'nothing-to-commit' }
  | { outcome: 'skipped'; reason: GitSyncSkipReason }
  | { outcome: 'failed'; error: Error }

// ── Injected effects ─────────────────────────────────────────────────────────

/** Runs a command in `cwd`. This function never rejects. A non-zero exit code is a normal return value, not an error. */
export type GitExec = (
  command: string,
  cwd: string
) => Promise<string | GitCommandError>

export interface GitSyncDeps {
  exec: GitExec
  fileExists: (filepath: string) => boolean
  notify: NotifyGitSync
}

function execInRepo(
  command: string,
  cwd: string
): Promise<string | GitCommandError> {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve(
          new GitCommandError(
            command,
            stdout ?? '',
            stderr ?? '',
            stderr?.trim() || error.message
          )
        )
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

export const defaultGitSyncDeps: GitSyncDeps = {
  exec: execInRepo,
  fileExists: (filepath) => fs.existsSync(filepath),
  notify: notifyGitSyncToSlack
}

// ── Shell + path helpers ─────────────────────────────────────────────────────

function shellEscape(value: string): string {
  return value.replace(/'/g, "'\\''")
}

export function shellQuote(value: string): string {
  return `'${shellEscape(value)}'`
}

export function expandHomeDir(filepath: string): string {
  return filepath.startsWith('~/')
    ? path.join(os.homedir(), filepath.slice(2))
    : filepath
}

export function toGitPath(repoRoot: string, filepath: string): string | null {
  const relative = path.isAbsolute(filepath)
    ? path.relative(repoRoot, filepath)
    : filepath
  if (!relative || relative === '.') return null

  // Ignore paths outside the target repository.
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    console.warn(`⚠️  Skipping out-of-repo path for git sync: ${filepath}`)
    return null
  }

  return relative.replace(/\\/g, '/')
}

function quoteGitPaths(paths: string[]): string[] {
  return [...new Set(paths)].map((value) => shellQuote(value))
}

// ── Repo resolution ──────────────────────────────────────────────────────────

export function isGitSyncDisabled(): boolean {
  return process.env.STRAPI_DISABLE_GIT_SYNC === 'true'
}

export function getTargetRepoRoot(): string {
  const configured = process.env.STRAPI_GIT_SYNC_REPO_PATH
  return configured ? path.resolve(expandHomeDir(configured)) : getProjectRoot()
}

// ── Startup validation ───────────────────────────────────────────────────────

export async function validateGitSyncRepoOnStartup(
  deps: GitSyncDeps = defaultGitSyncDeps
): Promise<void> {
  if (isGitSyncDisabled()) {
    console.log('⏭️  Git sync validation skipped via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  // In the past, git sync ran without Slack alerts. A rejected push then
  // left editor content stuck, with only a console line as a record.
  if (!isSlackAlertingConfigured()) {
    throw new Error(
      'SLACK_WEBHOOK_URL is not set while git sync is enabled, so sync failures ' +
        'would go unreported. Set SLACK_WEBHOOK_URL, or set ' +
        'STRAPI_DISABLE_GIT_SYNC=true for local development and CI.'
    )
  }

  const repoRoot = getTargetRepoRoot()

  if (!deps.fileExists(repoRoot)) {
    throw new Error(
      `Git sync repository path does not exist: ${repoRoot}. ` +
        `Set STRAPI_GIT_SYNC_REPO_PATH or create the staging clone.`
    )
  }

  if (!deps.fileExists(path.join(repoRoot, '.git'))) {
    throw new Error(`Git sync repository is not a git checkout: ${repoRoot}`)
  }

  const branch = await deps.exec('git rev-parse --abbrev-ref HEAD', repoRoot)
  if (branch instanceof Error) throw branch

  console.log(
    `✅ Git sync repository validated: ${repoRoot} (branch: ${branch})`
  )
}

// ── Git status + commit message inference ───────────────────────────────────

export function parseGitStatusLine(line: string): GitStatusChange | null {
  if (!line.trim()) return null

  const status = line.slice(0, 2).trim()
  // git status --porcelain: "XY PATH" (2-char status + space); slice(3) skips to path
  const rawPath = line.slice(3).trimStart()
  const filepath = rawPath.includes(' -> ')
    ? (rawPath.split(' -> ').pop() ?? rawPath)
    : rawPath

  return {
    status,
    filepath
  }
}

function isDeleted(status: string): boolean {
  return status.includes('D')
}

function isAdded(status: string): boolean {
  return status === '??' || status.includes('A')
}

function isModified(status: string): boolean {
  return status.includes('M') || status.includes('R') || status.includes('C')
}

async function getGitStatus(
  cwd: string,
  deps: GitSyncDeps
): Promise<GitStatusChange[] | GitCommandError> {
  const output = await deps.exec('git status --porcelain', cwd)
  if (output instanceof GitCommandError) return output
  if (!output) return []

  return output
    .split('\n')
    .map(parseGitStatusLine)
    .filter((change): change is GitStatusChange => Boolean(change))
}

export function extractSlug(filepath: string): string {
  const basename = path.basename(filepath, path.extname(filepath))
  const dateMatch = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return dateMatch ? dateMatch[1] : basename
}

export function inferCommitMessage(
  label: string,
  changes: GitStatusChange[]
): string {
  const contentChanges = changes.filter((c) =>
    CONTENT_PATH_PREFIXES.some((prefix) => c.filepath.startsWith(prefix))
  )

  if (contentChanges.length === 0) return `${label}: sync`

  const deleted = contentChanges.filter((c) => isDeleted(c.status))
  const added = contentChanges.filter((c) => isAdded(c.status))
  const modified = contentChanges.filter((c) => isModified(c.status))

  if (contentChanges.length === 1) {
    const [change] = contentChanges
    const pathSlug = extractSlug(change.filepath)
    if (isDeleted(change.status)) return `${label}: delete ${pathSlug}`
    if (isModified(change.status)) return `${label}: update ${pathSlug}`
    return `${label}: create ${pathSlug}`
  }

  const deletedSlugs = [...new Set(deleted.map((c) => extractSlug(c.filepath)))]
  const addedSlugs = [...new Set(added.map((c) => extractSlug(c.filepath)))]

  // Rename: 1 delete + 1 add with different slugs
  if (deleted.length === 1 && added.length === 1 && modified.length === 0) {
    if (deletedSlugs[0] !== addedSlugs[0]) {
      return `${label}: rename ${deletedSlugs[0]} -> ${addedSlugs[0]}`
    }
  }

  // Re-slug as update: 1 delete + 1 add with same pathSlug
  if (
    deleted.length === 1 &&
    added.length === 1 &&
    deletedSlugs[0] === addedSlugs[0]
  ) {
    return `${label}: update ${deletedSlugs[0]}`
  }

  // Bulk summary
  const parts: string[] = []
  if (deleted.length > 0) parts.push(`${deleted.length} deleted`)
  if (added.length > 0) parts.push(`${added.length} created`)
  if (modified.length > 0) parts.push(`${modified.length} modified`)
  return `${label}: sync (${parts.join(', ')})`
}

// ── Git operations ───────────────────────────────────────────────────────────

function getStagePaths(repoRoot: string, deps: GitSyncDeps): string[] {
  const stagePaths = STAGE_CANDIDATES.filter((p) =>
    deps.fileExists(path.join(repoRoot, p))
  )
  return quoteGitPaths(stagePaths)
}

export function buildCommitCommand(
  addPaths: string[],
  message: string,
  author?: { name: string; email: string }
): string {
  const safeMessage = shellQuote(message)
  const authorFlag = author
    ? ` --author=${shellQuote(`${author.name} <${author.email}>`)}`
    : ''
  return [
    `git add ${addPaths.join(' ')}`,
    `git commit -m ${safeMessage}${authorFlag}`,
    'git pull --rebase',
    'git push'
  ].join(' && ')
}

async function commitAndPush(
  repoRoot: string,
  addPaths: string[],
  message: string,
  deps: GitSyncDeps,
  author?: { name: string; email: string }
): Promise<GitSyncResult> {
  const result = await deps.exec(
    buildCommitCommand(addPaths, message, author),
    repoRoot
  )

  if (result instanceof GitCommandError) {
    if (result.combinedOutput.includes('nothing to commit')) {
      console.log(`[gitSync] Nothing to commit`)
      return { outcome: 'nothing-to-commit' }
    }
    console.error(`⚠️  Git sync failed: ${result.message}`)
    if (result.stderr) console.error(`stderr: ${result.stderr}`)
    return { outcome: 'failed', error: result }
  }

  console.log(`✅ Git sync complete: ${message}`)
  if (result) console.log(result)
  return { outcome: 'synced', message }
}

// ── Reporting ────────────────────────────────────────────────────────────────

interface ReportContext {
  label: string
  repoRoot: string
  commitMessage?: string
  author?: { name: string; email: string }
}

/**
 * This is the only path from a {@link GitSyncResult} to a Slack alert.
 * A `skipped` result does not show repo health. So this function sends
 * no alert for it, and clears no open failure for it.
 */
async function report(
  result: GitSyncResult,
  context: ReportContext,
  deps: GitSyncDeps
): Promise<GitSyncResult> {
  if (result.outcome === 'skipped') return result

  const alert: GitSyncAlert =
    result.outcome === 'failed'
      ? {
          outcome: 'failed',
          label: context.label,
          repoRoot: context.repoRoot,
          commitMessage: context.commitMessage,
          author: context.author,
          reason: result.error.message,
          detail:
            result.error instanceof GitCommandError
              ? result.error.combinedOutput
              : result.error.stack
        }
      : {
          outcome: 'healthy',
          label: context.label,
          repoRoot: context.repoRoot,
          commitMessage: context.commitMessage
        }

  // A report must not change the control flow. The `notify` function is
  // injectable. If it throws, a handled failure could become a rejected
  // sync. This catch block stops that from happening.
  const notified = await tryCatchAsync(() => deps.notify(alert))
  if (notified instanceof Error) {
    console.error(`⚠️  Git sync alert failed to send: ${notified.message}`)
  }

  return result
}

// ── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Stage the content directories. Commit the changes. Push the commit.
 * The function builds the commit message from the actual git status,
 * unless {@link SyncContext} gives a message.
 *
 * This function never rejects. It reports an unexpected error and
 * returns a `failed` result. This way, every outage reaches Slack.
 */
export async function runGitSync(
  label: string,
  context?: SyncContext,
  deps: GitSyncDeps = defaultGitSyncDeps
): Promise<GitSyncResult> {
  if (isGitSyncDisabled()) return { outcome: 'skipped', reason: 'disabled' }

  const repoRoot = await tryCatchAsync(() => getTargetRepoRoot())
  if (repoRoot instanceof Error) {
    console.error(
      `⚠️  Git sync failed to resolve repo root: ${repoRoot.message}`
    )
    return report(
      { outcome: 'failed', error: repoRoot },
      { label, repoRoot: 'unresolved' },
      deps
    )
  }

  const result = await tryCatchAsync(() =>
    syncContentDirectories(label, repoRoot, context, deps)
  )
  if (!(result instanceof Error)) return result

  console.error(`⚠️  Git sync failed unexpectedly: ${result.message}`)
  return report({ outcome: 'failed', error: result }, { label, repoRoot }, deps)
}

async function syncContentDirectories(
  label: string,
  repoRoot: string,
  context: SyncContext | undefined,
  deps: GitSyncDeps
): Promise<GitSyncResult> {
  const changes = await getGitStatus(repoRoot, deps)

  if (changes instanceof GitCommandError) {
    console.error(`⚠️  Git sync failed to read status: ${changes.message}`)
    return report(
      { outcome: 'failed', error: changes },
      { label, repoRoot },
      deps
    )
  }

  if (changes.length === 0) {
    console.log(`[gitSync] No changes to commit`)
    return { outcome: 'skipped', reason: 'no-changes' }
  }

  const stagePaths = getStagePaths(repoRoot, deps)
  if (stagePaths.length === 0) {
    console.log(`[gitSync] No content directories to stage`)
    return { outcome: 'skipped', reason: 'no-stage-paths' }
  }

  const message =
    context?.slug && context?.action
      ? `${label}: ${context.action} ${context.slug}`
      : inferCommitMessage(label, changes)
  console.log(`[gitSync] Inferred message: ${message}`)

  const result = await commitAndPush(
    repoRoot,
    stagePaths,
    message,
    deps,
    context?.author
  )
  return report(
    result,
    { label, repoRoot, commitMessage: message, author: context?.author },
    deps
  )
}

// ── Debounced sync ───────────────────────────────────────────────────────────

export interface DebouncedGitSync {
  /**
   * Add a sync to the queue. Calls inside the debounce window merge into
   * one commit. The label and context from the last call apply.
   */
  schedule(label: string, context?: SyncContext): void
  /**
   * The most recent flush, or `null` if no flush has started yet. Callers
   * can use this to check the result of a background sync.
   */
  settled(): Promise<GitSyncResult | null>
}

export function createDebouncedGitSync(
  deps: GitSyncDeps = defaultGitSyncDeps,
  delayMs: number = DEBOUNCE_MS
): DebouncedGitSync {
  let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null
  let latestContext: SyncContext | undefined
  let lastFlush: Promise<GitSyncResult> | null = null

  return {
    schedule(label, context) {
      if (isGitSyncDisabled()) {
        console.log(
          '⏭️  Git sync scheduling skipped via STRAPI_DISABLE_GIT_SYNC'
        )
        return
      }

      if (pendingSyncTimer) clearTimeout(pendingSyncTimer)
      latestContext = context

      pendingSyncTimer = setTimeout(() => {
        pendingSyncTimer = null
        const ctx = latestContext
        latestContext = undefined
        // runGitSync reports its own failures. It should never reject.
        // This catch is a backup only. It stops a future code error from
        // causing an unhandled rejection in this timer callback.
        lastFlush = runGitSync(label, ctx, deps).catch((err: unknown) => {
          console.error(`[gitSync] Flush error:`, err)
          const error = err instanceof Error ? err : new Error(String(err))
          return { outcome: 'failed', error } as GitSyncResult
        })
      }, delayMs)
    },

    settled() {
      return lastFlush ?? Promise.resolve(null)
    }
  }
}

const defaultScheduler = createDebouncedGitSync()

/**
 * Schedule a debounced git sync. Multiple calls inside {@link DEBOUNCE_MS}
 * merge into one commit.
 */
export function scheduleGitSync(label: string, context?: SyncContext): void {
  defaultScheduler.schedule(label, context)
}

/** The most recent scheduled flush. Callers can use this to check the result. */
export function settledGitSync(): Promise<GitSyncResult | null> {
  return defaultScheduler.settled()
}

/**
 * Commit specific files now, with a fixed message.
 * Use this function for cases like navigation updates. In these cases,
 * the code does not need to infer the git status.
 *
 * This function never rejects, in the same way as {@link runGitSync}.
 */
export async function gitCommitAndPush(
  filepath: string | string[],
  message: string,
  deps: GitSyncDeps = defaultGitSyncDeps
): Promise<GitSyncResult> {
  if (isGitSyncDisabled()) {
    console.log('⏭️  Git sync commit skipped via STRAPI_DISABLE_GIT_SYNC')
    return { outcome: 'skipped', reason: 'disabled' }
  }

  const repoRoot = await tryCatchAsync(() => getTargetRepoRoot())
  if (repoRoot instanceof Error) {
    console.error(
      `⚠️  Git sync failed to resolve repo root: ${repoRoot.message}`
    )
    return report(
      { outcome: 'failed', error: repoRoot },
      { label: 'navigation', repoRoot: 'unresolved', commitMessage: message },
      deps
    )
  }

  const result = await tryCatchAsync(() =>
    commitExplicitPaths(filepath, message, repoRoot, deps)
  )
  if (!(result instanceof Error)) return result

  console.error(`⚠️  Git sync failed unexpectedly: ${result.message}`)
  return report(
    { outcome: 'failed', error: result },
    { label: 'navigation', repoRoot, commitMessage: message },
    deps
  )
}

async function commitExplicitPaths(
  filepath: string | string[],
  message: string,
  repoRoot: string,
  deps: GitSyncDeps
): Promise<GitSyncResult> {
  const rawPaths = Array.isArray(filepath) ? filepath : [filepath]
  const normalizedPaths = rawPaths
    .map((fp) => toGitPath(repoRoot, fp))
    .filter((p): p is string => Boolean(p))

  const uploadsDir = path.join(repoRoot, UPLOADS_DIR)
  if (deps.fileExists(uploadsDir)) {
    const uploadsPath = toGitPath(repoRoot, uploadsDir)
    if (uploadsPath) normalizedPaths.push(uploadsPath)
  }

  const paths = quoteGitPaths(normalizedPaths)
  if (paths.length === 0) {
    console.log('[gitSync] No valid paths to stage')
    return { outcome: 'skipped', reason: 'no-valid-paths' }
  }

  const result = await commitAndPush(repoRoot, paths, message, deps)
  return report(
    result,
    { label: 'navigation', repoRoot, commitMessage: message },
    deps
  )
}
