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
  type NotifyGitSync,
  type ResolvedPath
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

const REMOTE = 'origin'
/** Bounded so a persistent outage cannot hold a lifecycle hook open indefinitely. */
const MAX_PUSH_ATTEMPTS = 3
const PUSH_BACKOFF_MS = 750
/**
 * A rebase can stop once per replayed commit, so the resolve/continue loop can
 * legitimately run more than once. The cap stops a malformed status from
 * looping forever.
 */
const MAX_RESOLVE_ROUNDS = 10

/**
 * The residual resolver runs `git rm -f`, so it is confined to the directories
 * the CMS owns. An unmerged path outside them belongs to a developer and is
 * never resolved automatically — the rebase is aborted and a human decides.
 */
const RESOLVABLE_PREFIXES = [CONTENT_DIR, UPLOADS_DIR] as const

/**
 * Another git process held the lock. The daily sync and editor saves run
 * against the same checkout, so this is contention, not a real failure.
 */
const RETRYABLE_ERROR =
  /index\.lock|cannot lock ref|unable to create|another git process/i

/**
 * State files that mean an operation was interrupted. Any of them present
 * fails every later git command in the checkout, so a sync clears them first.
 */
const INTERRUPTED_OPERATION_PATHS = [
  'rebase-merge',
  'rebase-apply',
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD'
] as const

/**
 * Unmerged porcelain codes. Every one of them contains a `U`, or is `AA`/`DD`
 * which git emits only for an unmerged entry, so a trimmed two-character
 * status is an exact match.
 */
const UNMERGED_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

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
 * What integrating the commit had to overwrite. Present on a `synced` result
 * only when the push was rejected and the rebase resolved a conflict in the
 * CMS's favour.
 */
export interface ConflictResolution {
  /** Paths where a conflicting hunk was taken from the CMS side. */
  overwrittenPaths: string[]
  /** Existence conflicts the residual resolver settled, with the action taken. */
  resolvedPaths: ResolvedPath[]
  /** Upstream commits whose changes were superseded, as `<sha> <subject>`. */
  supersededCommits: string[]
}

/**
 * The result of one sync attempt. This type shows the difference between
 * a harmless no-op and a real failure. The console logs alone did not
 * show this difference.
 *
 * `conflict` is optional so an ordinary clean sync keeps the shape it had.
 */
export type GitSyncResult =
  | { outcome: 'synced'; message: string; conflict?: ConflictResolution }
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
  /** Injected so the push backoff is testable without real time passing. */
  sleep: (ms: number) => Promise<void>
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
  notify: notifyGitSyncToSlack,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
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

  // A restart is the natural moment to clear a checkout an earlier run left
  // mid-operation, and doing it here puts the state in the boot log.
  const recovered = await recoverInterruptedOperation(repoRoot, deps)
  if (recovered instanceof Error) throw recovered

  console.log(
    `✅ Git sync repository validated: ${repoRoot} (branch: ${branch})` +
      (recovered === 'recovered' ? ' — cleared an interrupted operation' : '')
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

/**
 * A path git could not merge. These have to be caught before the commit step:
 * every unmerged code also satisfies {@link isModified} or {@link isAdded}, so
 * without this check a conflicted tree reads as an ordinary change and the
 * conflict markers get committed into the MDX.
 */
export function isUnmerged(status: string): boolean {
  return UNMERGED_CODES.has(status)
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

export function buildAddCommand(addPaths: string[]): string {
  return `git add -- ${addPaths.join(' ')}`
}

export function buildCommitCommand(
  message: string,
  author?: { name: string; email: string }
): string {
  const authorFlag = author
    ? ` --author=${shellQuote(`${author.name} <${author.email}>`)}`
    : ''
  return `git commit -m ${shellQuote(message)}${authorFlag}`
}

export function buildFetchCommand(branch: string): string {
  return `git fetch ${REMOTE} ${shellQuote(branch)}`
}

export function buildPushCommand(branch: string): string {
  return `git push ${REMOTE} HEAD:${shellQuote(branch)}`
}

/**
 * Replays the local commit on top of the upstream branch, resolving any
 * conflicting hunk in favour of the CMS.
 *
 * `-X theirs` is correct and is not a typo. A rebase replays the local commit
 * on top of `<upstream>`, so git reports the upstream as `ours` and the
 * replayed commit as `theirs` — the sides are swapped (git-rebase(1), "Using
 * merging strategies to rebase": *"the side reported as `ours` is the so-far
 * rebased series, starting with `<upstream>`, and `theirs` is the working
 * branch"*). Here `ours` is the developers' merged PR and `theirs` is the
 * editor's save, so `-X theirs` is the "CMS content wins" policy. Changing it
 * to `-X ours` silently inverts that policy.
 *
 * `autoStash` covers files Strapi wrote between `git add` and this command,
 * which would otherwise make the rebase refuse to start. `rerere` is pinned off
 * so a resolution recorded in the machine's global git config cannot override
 * the policy.
 */
export function buildRebaseCommand(upstreamRef: string): string {
  return (
    'git -c rebase.autoStash=true -c rerere.enabled=false ' +
    `rebase -X theirs ${shellQuote(upstreamRef)}`
  )
}

/**
 * Reports the paths a merge would conflict on, without touching HEAD, the index
 * or the working tree — `--write-tree` performs the merge in the object store
 * alone. Run before the rebase, because `-X theirs` resolves silently: `ort`
 * prints no `CONFLICT` line when a strategy option takes the hunk, so the
 * rebase output cannot tell us what was overwritten.
 *
 * Exits non-zero with `<tree-oid>\0<path>\0…` on stdout when there is a
 * conflict, so the result arrives as a {@link GitCommandError} carrying the
 * paths.
 */
export function buildConflictProbeCommand(upstreamRef: string): string {
  return (
    'git merge-tree --write-tree --name-only -z ' +
    `${shellQuote(upstreamRef)} HEAD`
  )
}

/**
 * `--continue` opens an editor for the commit message by default, which would
 * hang forever in a lifecycle hook with no TTY.
 */
export function buildRebaseContinueCommand(): string {
  return 'git -c core.editor=true rebase --continue'
}

function isRetryable(error: GitCommandError): boolean {
  return RETRYABLE_ERROR.test(error.combinedOutput)
}

// ── Interrupted-operation recovery ───────────────────────────────────────────

/**
 * Clears an interrupted rebase, merge or cherry-pick.
 *
 * A sync that died mid-rebase used to poison the checkout: every later editor
 * save failed, and the daily workflow's integrate step failed with it, until
 * someone cleared it by hand. Recovering here makes that self-healing.
 *
 * Detection goes through `git rev-parse --git-path` rather than testing
 * `.git/rebase-merge` directly — that is what git's own `wt_status_get_state()`
 * does, and it stays correct for a linked worktree or a `.git` file, where the
 * state lives outside `<repo>/.git/`.
 */
export async function recoverInterruptedOperation(
  repoRoot: string,
  deps: GitSyncDeps
): Promise<'clean' | 'recovered' | GitCommandError> {
  const probe = INTERRUPTED_OPERATION_PATHS.map(
    (name) => `--git-path ${name}`
  ).join(' ')
  const output = await deps.exec(`git rev-parse ${probe}`, repoRoot)
  if (output instanceof GitCommandError) return output

  const present = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && deps.fileExists(path.resolve(repoRoot, line)))

  if (present.length === 0) return 'clean'

  console.warn(
    `⚠️  Checkout was left mid-operation (${present.join(', ')}) — clearing it.`
  )
  // Only one operation can be in progress. The other two exit non-zero with
  // nothing to undo, which is why each is best-effort.
  await deps.exec('git rebase --abort', repoRoot)
  await deps.exec('git merge --abort', repoRoot)
  await deps.exec('git cherry-pick --abort', repoRoot)
  return 'recovered'
}

// ── Conflict description + residual resolution ───────────────────────────────

async function getUnmergedChanges(
  repoRoot: string,
  deps: GitSyncDeps
): Promise<GitStatusChange[] | GitCommandError> {
  const changes = await getGitStatus(repoRoot, deps)
  if (changes instanceof GitCommandError) return changes
  return changes.filter((change) => isUnmerged(change.status))
}

function isResolvablePath(filepath: string): boolean {
  return RESOLVABLE_PREFIXES.some((prefix) => filepath.startsWith(prefix))
}

/**
 * Records what the rebase is about to overwrite, so the Slack alert can name
 * the developer work the CMS superseded. Best-effort: a probe that cannot run
 * must not fail the sync, it just yields a less informative alert.
 */
async function describeConflict(
  repoRoot: string,
  upstreamRef: string,
  deps: GitSyncDeps
): Promise<ConflictResolution | undefined> {
  const probe = await deps.exec(
    buildConflictProbeCommand(upstreamRef),
    repoRoot
  )
  // A clean merge exits zero. So does a git too old for `--write-tree`, which
  // reports an unknown option on stderr — either way there is nothing to say.
  if (!(probe instanceof GitCommandError)) return undefined

  // stdout is `<tree-oid>\0<path>\0…\0\0<informational messages>`. The file
  // list ends at an empty field, and an "Auto-merging"/"CONFLICT" message
  // section follows it — filtering empties out first would splice the two
  // together and report the messages as if they were paths.
  const fields = probe.stdout.split('\0')
  const endOfPaths = fields.indexOf('', 1)
  const paths = (
    endOfPaths === -1 ? fields.slice(1) : fields.slice(1, endOfPaths)
  ).filter(Boolean)
  if (paths.length === 0) return undefined

  const log = await deps.exec(
    `git log --oneline --no-decorate HEAD..${shellQuote(upstreamRef)} -- ` +
      paths.map(shellQuote).join(' '),
    repoRoot
  )

  return {
    overwrittenPaths: paths,
    resolvedPaths: [],
    supersededCommits:
      log instanceof GitCommandError ? [] : log.split('\n').filter(Boolean)
  }
}

/**
 * Settles the conflicts `-X theirs` cannot take on its own.
 *
 * `-X theirs` is a content-level option: it resolves conflicting hunks, binary
 * files and add/add, but not conflicts about a path's *existence* — git leaves
 * those unmerged because there is no hunk to pick a side of. Each is resolved
 * toward the CMS, matching the policy.
 *
 * Resolution is confined to {@link RESOLVABLE_PREFIXES}. Half the branches here
 * delete a file, and an unmerged path outside the CMS-owned directories belongs
 * to a developer — that case aborts instead, and a human decides.
 */
async function resolveUnmergedTowardCms(
  repoRoot: string,
  deps: GitSyncDeps
): Promise<ResolvedPath[] | GitCommandError> {
  const unmerged = await getUnmergedChanges(repoRoot, deps)
  if (unmerged instanceof GitCommandError) return unmerged

  const offLimits = unmerged.filter(
    (change) => !isResolvablePath(change.filepath)
  )
  if (offLimits.length > 0) {
    return new GitCommandError(
      'resolve unmerged',
      '',
      offLimits.map((c) => `${c.status} ${c.filepath}`).join('\n'),
      `Unmerged path(s) outside the CMS-owned directories need a human: ` +
        offLimits.map((c) => c.filepath).join(', ')
    )
  }

  const resolved: ResolvedPath[] = []

  for (const { status, filepath } of unmerged) {
    // `--theirs` is swapped during a rebase in the same way `-X theirs` is: it
    // gives the version from the branch being replayed, which is the CMS side.
    const keepCms =
      `git checkout --theirs -- ${shellQuote(filepath)} && ` +
      `git add -- ${shellQuote(filepath)}`
    const deleteFile = `git rm -f -- ${shellQuote(filepath)}`

    // `UD` is upstream-modified/CMS-deleted, `AU` an upstream-side rename
    // destination, `DD` deleted on both. In each the CMS says the path is gone.
    const command =
      status === 'UD' || status === 'AU' || status === 'DD'
        ? deleteFile
        : keepCms

    const outcome = await deps.exec(command, repoRoot)
    if (outcome instanceof GitCommandError) return outcome

    resolved.push({
      path: filepath,
      action: command === deleteFile ? 'deleted' : 'kept-cms'
    })
  }

  return resolved
}

/**
 * Runs the rebase, resolving anything `-X theirs` left behind.
 *
 * Returns an error rather than leaving the checkout mid-rebase: the caller
 * aborts on any error, and `git rebase --abort` restores the pre-rebase HEAD
 * and re-applies the autostash, so nothing is lost.
 */
async function rebaseOntoUpstream(
  repoRoot: string,
  upstreamRef: string,
  deps: GitSyncDeps
): Promise<ResolvedPath[] | GitCommandError> {
  let outcome = await deps.exec(buildRebaseCommand(upstreamRef), repoRoot)
  const resolved: ResolvedPath[] = []

  for (let round = 0; outcome instanceof GitCommandError; round++) {
    if (round >= MAX_RESOLVE_ROUNDS) {
      return new GitCommandError(
        'rebase',
        '',
        outcome.combinedOutput,
        `Rebase still unresolved after ${MAX_RESOLVE_ROUNDS} rounds`
      )
    }

    const roundResolved = await resolveUnmergedTowardCms(repoRoot, deps)
    if (roundResolved instanceof GitCommandError) return roundResolved
    // The rebase failed but nothing is unmerged, so it stopped for a reason
    // this resolver cannot address (a refused start, a hook, a broken ref).
    if (roundResolved.length === 0) return outcome

    resolved.push(...roundResolved)
    outcome = await deps.exec(buildRebaseContinueCommand(), repoRoot)
  }

  // A `-X theirs` rebase that exits zero leaves nothing unmerged, so anything
  // here came from the autostash pop. Those are conflict markers sitting in the
  // working tree, where the next debounced save would commit them into MDX.
  const residue = await getUnmergedChanges(repoRoot, deps)
  if (residue instanceof GitCommandError) return residue
  if (residue.length > 0) {
    return new GitCommandError(
      'autostash pop',
      residue.map((c) => c.filepath).join('\n'),
      '',
      `Autostash left ${residue.length} unmerged path(s) after the rebase; ` +
        `the working tree may contain conflict markers`
    )
  }

  return resolved
}

// ── Push ─────────────────────────────────────────────────────────────────────

interface PushOutcome {
  pushed: boolean
  conflict?: ConflictResolution
  error?: GitCommandError
}

/**
 * Pushes, and integrates only when the remote rejects.
 *
 * The common case is a clean fast-forward, and that path never fetches,
 * rebases or stashes — so it never touches a working tree Strapi may be
 * mid-write on. Mirrors the loop in
 * `.github/workflows/strapi-rebuild-and-sync.yml`.
 */
async function pushWithRebase(
  repoRoot: string,
  branch: string,
  deps: GitSyncDeps
): Promise<PushOutcome> {
  const upstreamRef = `${REMOTE}/${branch}`
  let conflict: ConflictResolution | undefined
  let lastError: GitCommandError | undefined

  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    const pushed = await deps.exec(buildPushCommand(branch), repoRoot)
    if (!(pushed instanceof GitCommandError)) return { pushed: true, conflict }
    lastError = pushed

    if (attempt === MAX_PUSH_ATTEMPTS) break
    await deps.sleep(PUSH_BACKOFF_MS * attempt)

    // Lock contention means another writer holds the repo, not that the push
    // was rejected. Retrying the push is the whole fix.
    if (isRetryable(pushed)) continue

    const fetched = await deps.exec(buildFetchCommand(branch), repoRoot)
    if (fetched instanceof GitCommandError) {
      lastError = fetched
      continue
    }

    conflict = (await describeConflict(repoRoot, upstreamRef, deps)) ?? conflict

    const resolved = await rebaseOntoUpstream(repoRoot, upstreamRef, deps)
    if (resolved instanceof GitCommandError) {
      lastError = resolved
      // Leaving the checkout mid-rebase would break every later save and the
      // daily workflow alike. `--abort` also restores the autostash.
      await deps.exec('git rebase --abort', repoRoot)
      break
    }

    if (resolved.length > 0) {
      conflict = {
        overwrittenPaths: conflict?.overwrittenPaths ?? [],
        supersededCommits: conflict?.supersededCommits ?? [],
        resolvedPaths: resolved
      }
    }
  }

  return { pushed: false, conflict, error: lastError }
}

/**
 * Hands the checkout back with no unpushed commits.
 *
 * The daily workflow integrates with `git pull --ff-only` under `set -e`, so a
 * single stranded local commit fails the whole run — rebuild, content sync and
 * Airtable sync alike — not just this sync. `--soft` keeps the content staged,
 * so the next `git status` still reports it and the next debounced save retries
 * it automatically.
 *
 * Guarded on the ahead-count rather than resetting blindly: the workflow's
 * Airtable step holds an unpushed commit of its own for up to ~75s during its
 * retry loop, and dropping `HEAD~1` inside that window would discard another
 * writer's work.
 */
async function unwindLocalCommit(
  repoRoot: string,
  branch: string,
  deps: GitSyncDeps
): Promise<'unwound' | 'left-in-place' | GitCommandError> {
  const ahead = await deps.exec(
    `git rev-list --count ${shellQuote(`${REMOTE}/${branch}`)}..HEAD`,
    repoRoot
  )
  if (ahead instanceof GitCommandError) return ahead

  const count = Number.parseInt(ahead.trim(), 10)
  // Zero is normal: `-X theirs` can make the commit identical to upstream, and
  // rebase drops an empty commit by default.
  if (!Number.isFinite(count) || count === 0) return 'left-in-place'

  if (count > 1) {
    console.error(
      `⚠️  ${count} unpushed local commits — leaving them in place. ` +
        `Another writer may own one of them.`
    )
    return 'left-in-place'
  }

  const reset = await deps.exec('git reset --soft HEAD~1', repoRoot)
  return reset instanceof GitCommandError ? reset : 'unwound'
}

/**
 * Pushes commits an interrupted run left behind, with nothing new to commit.
 *
 * `git push` on an already-current branch exits zero, so the no-op case costs
 * one command and reports a healthy repo — which, straight after a recovery,
 * is the right thing to say.
 */
async function pushRecoveredCommits(
  repoRoot: string,
  deps: GitSyncDeps
): Promise<GitSyncResult> {
  const branch = await deps.exec('git rev-parse --abbrev-ref HEAD', repoRoot)
  if (branch instanceof GitCommandError) {
    return { outcome: 'failed', error: branch }
  }

  const push = await pushWithRebase(repoRoot, branch, deps)
  if (push.pushed) {
    const message = 'recovered: push commits left by an interrupted sync'
    console.log(`✅ ${message}`)
    return { outcome: 'synced', message, conflict: push.conflict }
  }

  return {
    outcome: 'failed',
    error:
      push.error ??
      new Error('Could not push commits left by an interrupted sync')
  }
}

async function commitAndPush(
  repoRoot: string,
  addPaths: string[],
  message: string,
  deps: GitSyncDeps,
  author?: { name: string; email: string }
): Promise<GitSyncResult> {
  const branch = await deps.exec('git rev-parse --abbrev-ref HEAD', repoRoot)
  if (branch instanceof GitCommandError) {
    console.error(`⚠️  Git sync failed to read the branch: ${branch.message}`)
    return { outcome: 'failed', error: branch }
  }

  const added = await deps.exec(buildAddCommand(addPaths), repoRoot)
  if (added instanceof GitCommandError) {
    console.error(`⚠️  Git sync failed to stage: ${added.message}`)
    return { outcome: 'failed', error: added }
  }

  const committed = await deps.exec(
    buildCommitCommand(message, author),
    repoRoot
  )
  if (committed instanceof GitCommandError) {
    if (committed.combinedOutput.includes('nothing to commit')) {
      console.log(`[gitSync] Nothing to commit`)
      return { outcome: 'nothing-to-commit' }
    }
    console.error(`⚠️  Git sync failed to commit: ${committed.message}`)
    if (committed.stderr) console.error(`stderr: ${committed.stderr}`)
    return { outcome: 'failed', error: committed }
  }

  const push = await pushWithRebase(repoRoot, branch, deps)
  if (push.pushed) {
    console.log(`✅ Git sync complete: ${message}`)
    return { outcome: 'synced', message, conflict: push.conflict }
  }

  const error =
    push.error ?? new Error('Git sync could not push, with no error reported')
  console.error(`⚠️  Git sync failed: ${error.message}`)

  const unwound = await unwindLocalCommit(repoRoot, branch, deps)
  return {
    outcome: 'failed',
    error: unwound instanceof Error ? unwound : error
  }
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

  // Sent in addition to the `healthy` alert above, not instead of it: that one
  // clears an open failure, this one is the audit record of the developer work
  // the CMS superseded. Nothing lints a direct push to the deploy branch, so
  // without this the overwrite is invisible until it surfaces weeks later.
  if (result.outcome === 'synced' && result.conflict) {
    const { overwrittenPaths, resolvedPaths, supersededCommits } =
      result.conflict
    console.warn(
      `⚠️  Git sync overwrote branch changes in favour of the CMS: ` +
        [...overwrittenPaths, ...resolvedPaths.map((r) => r.path)].join(', ')
    )
    const sent = await tryCatchAsync(() =>
      deps.notify({
        outcome: 'conflict-resolved',
        label: context.label,
        repoRoot: context.repoRoot,
        commitMessage: context.commitMessage,
        author: context.author,
        overwrittenPaths,
        resolvedPaths,
        supersededCommits
      })
    )
    if (sent instanceof Error) {
      console.error(
        `⚠️  Git sync conflict alert failed to send: ${sent.message}`
      )
    }
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
  // Before reading status: a checkout left mid-rebase still reports changes,
  // so without this the sync would happily commit a conflicted tree.
  const recovered = await recoverInterruptedOperation(repoRoot, deps)
  if (recovered instanceof GitCommandError) {
    console.error(
      `⚠️  Git sync failed to check for an interrupted operation: ${recovered.message}`
    )
    return report(
      { outcome: 'failed', error: recovered },
      { label, repoRoot },
      deps
    )
  }

  const changes = await getGitStatus(repoRoot, deps)

  if (changes instanceof GitCommandError) {
    console.error(`⚠️  Git sync failed to read status: ${changes.message}`)
    return report(
      { outcome: 'failed', error: changes },
      { label, repoRoot },
      deps
    )
  }

  const unmerged = changes.filter((change) => isUnmerged(change.status))
  if (unmerged.length > 0) {
    const paths = unmerged.map((c) => c.filepath).join(', ')
    console.error(`⚠️  Git sync found unresolved conflicts: ${paths}`)
    return report(
      {
        outcome: 'failed',
        error: new Error(
          `Working tree has unresolved conflicts and may contain conflict ` +
            `markers, so nothing was committed: ${paths}`
        )
      },
      { label, repoRoot },
      deps
    )
  }

  if (changes.length === 0) {
    // A recovered checkout can still hold commits the interrupted run never
    // pushed. There is nothing to commit, but leaving them unpushed keeps the
    // branch diverged, which is the state the recovery exists to clear.
    if (recovered === 'recovered') {
      return report(
        await pushRecoveredCommits(repoRoot, deps),
        { label, repoRoot },
        deps
      )
    }
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
  const recovered = await recoverInterruptedOperation(repoRoot, deps)
  if (recovered instanceof GitCommandError) {
    console.error(
      `⚠️  Git sync failed to check for an interrupted operation: ${recovered.message}`
    )
    return report(
      { outcome: 'failed', error: recovered },
      { label: 'navigation', repoRoot, commitMessage: message },
      deps
    )
  }

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
