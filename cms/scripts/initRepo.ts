/**
 * Prepares the git checkout and the database folder before Strapi starts.
 *
 * Runs as the init container of the Strapi pod, through `cms-init-repo`. Strapi
 * is not running, so no git process holds a lock, and every lock file in the
 * checkout is stale.
 *
 * On an empty volume it clones the branch. On a used volume it:
 *   1. clears stale lock files, and aborts a half-finished rebase or merge;
 *   2. hard-resets to the remote branch, only when RESET_TOKEN is new;
 *   3. otherwise rebases local commits onto the remote branch, then pushes them.
 * It returns an Error on a conflict. The pod then stays in Init:Error, and no
 * commit is discarded.
 */
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { GitCommandError } from '../src/utils/gitSync'

const DEFAULT_DB_POLL_SECONDS = 5
const DB_REMINDER_SECONDS = 60
const MS_PER_SECOND = 1000
const GIT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024

/** Inside .git, so git never tracks it, and it lives as long as the checkout. */
const RESET_TOKEN_FILE = 'cms-reset-token'

export type DbBootstrap = 'wait' | 'create'

export interface InitRepoConfig {
  /** Repository to clone. */
  repoUrl: string
  /** Branch the checkout follows. */
  branch: string
  /** Folder of the checkout. */
  repoPath: string
  /** Absolute path of the SQLite database. */
  databaseFile: string
  /** wait: wait until `databaseFile` exists. create: do not wait. */
  dbBootstrap: DbBootstrap
  /** True: never push. */
  gitSyncDisabled: boolean
  /** A value that differs from the stored one resets. Empty: never reset. */
  resetToken: string
  /** Seconds between checks for the database file. */
  dbPollSeconds: number
}

// ── Injected effects ─────────────────────────────────────────────────────────

/** Runs git with `args` in `cwd`. Never rejects: a non-zero exit is a GitCommandError. */
export type RunGit = (
  args: string[],
  cwd: string
) => Promise<string | GitCommandError>

export interface InitRepoDeps {
  git: RunGit
  log: (message: string) => void
  sleep: (ms: number) => Promise<void>
}

/** A git runner that passes `env` to every command. Tests isolate git config through it. */
export function createGitRunner(env: NodeJS.ProcessEnv = process.env): RunGit {
  return (args, cwd) =>
    new Promise((resolve) => {
      execFile(
        'git',
        args,
        { cwd, env, maxBuffer: GIT_MAX_OUTPUT_BYTES },
        (error, stdout, stderr) => {
          const command = `git ${args.join(' ')}`
          if (error) {
            resolve(
              new GitCommandError(
                command,
                stdout,
                stderr,
                `${command}: ${stderr.trim() || error.message}`
              )
            )
            return
          }
          resolve(stdout.trim())
        }
      )
    })
}

export const defaultInitRepoDeps: InitRepoDeps = {
  git: createGitRunner(),
  log: (message) => console.log(`[cms-init-repo] ${message}`),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Configuration ────────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'GIT_REPO_URL',
  'GIT_BRANCH',
  'GIT_REPO_PATH',
  'DATABASE_FILENAME'
] as const

export function readInitRepoConfig(
  env: NodeJS.ProcessEnv
): InitRepoConfig | Error {
  const missing = REQUIRED_ENV.filter((name) => !env[name])
  if (missing.length > 0) {
    return new Error(`Missing environment variables: ${missing.join(', ')}`)
  }

  const dbBootstrap = env.DB_BOOTSTRAP || 'wait'
  if (dbBootstrap !== 'wait' && dbBootstrap !== 'create') {
    return new Error(
      `DB_BOOTSTRAP must be wait or create, not '${dbBootstrap}'`
    )
  }

  const dbPollSeconds = Number(env.DB_POLL_SECONDS || DEFAULT_DB_POLL_SECONDS)
  if (!Number.isInteger(dbPollSeconds) || dbPollSeconds <= 0) {
    return new Error(
      `DB_POLL_SECONDS must be a positive integer, not '${env.DB_POLL_SECONDS}'`
    )
  }

  return {
    repoUrl: env.GIT_REPO_URL!,
    branch: env.GIT_BRANCH!,
    repoPath: env.GIT_REPO_PATH!,
    databaseFile: env.DATABASE_FILENAME!,
    dbBootstrap,
    gitSyncDisabled: env.STRAPI_DISABLE_GIT_SYNC === 'true',
    resetToken: env.RESET_TOKEN ?? '',
    dbPollSeconds
  }
}

// ── Decisions ────────────────────────────────────────────────────────────────

/** A Force Reset discards local commits only for a token this volume has not seen. */
export function isNewResetToken(
  resetToken: string,
  storedToken: string | null
): boolean {
  return resetToken !== '' && resetToken !== storedToken
}

/** True when `waitedSeconds` falls on a reminder boundary, the first check included. */
export function isReminderDue(waitedSeconds: number): boolean {
  return waitedSeconds % DB_REMINDER_SECONDS === 0
}

export function parseCommitCount(output: string): number | Error {
  const count = Number(output)
  if (output === '' || !Number.isInteger(count) || count < 0) {
    return new Error(`Unexpected commit count from git: '${output}'`)
  }
  return count
}

// ── Filesystem helpers ───────────────────────────────────────────────────────

function isNonEmptyDir(dir: string): boolean {
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0
}

function resetTokenPath(repoPath: string): string {
  return path.join(repoPath, '.git', RESET_TOKEN_FILE)
}

function storeResetToken(config: InitRepoConfig): void {
  fs.writeFileSync(resetTokenPath(config.repoPath), config.resetToken)
}

function readStoredResetToken(repoPath: string): string | null {
  const file = resetTokenPath(repoPath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null
}

/** Every `*.lock` file under `.git`, as paths relative to the checkout. */
export function findLockFiles(repoPath: string): string[] {
  const gitDir = path.join(repoPath, '.git')
  return fs
    .readdirSync(gitDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.lock'))
    .map((entry) =>
      path.relative(repoPath, path.join(entry.parentPath, entry.name))
    )
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function cloneCheckout(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  if (isNonEmptyDir(config.repoPath)) {
    return new Error(
      `${config.repoPath} is not empty and is not a git checkout. Empty the volume.`
    )
  }
  const parentDir = path.dirname(config.repoPath)
  fs.mkdirSync(parentDir, { recursive: true })

  deps.log(
    `Cloning ${config.branch} from ${config.repoUrl} into ${config.repoPath}`
  )
  const cloned = await deps.git(
    ['clone', '--branch', config.branch, config.repoUrl, config.repoPath],
    parentDir
  )
  if (cloned instanceof Error) return cloned

  // A fresh clone already matches the remote. Storing the token stops the next
  // start from resetting it again.
  storeResetToken(config)
}

async function clearInterruptedState(
  repoPath: string,
  deps: InitRepoDeps
): Promise<void | Error> {
  for (const lockFile of findLockFiles(repoPath)) {
    fs.rmSync(path.join(repoPath, lockFile))
    deps.log(`Removed stale lock: ${lockFile}`)
  }

  const gitDir = path.join(repoPath, '.git')
  const rebaseInProgress =
    fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
    fs.existsSync(path.join(gitDir, 'rebase-apply'))
  if (rebaseInProgress) {
    deps.log('Aborting a half-finished rebase')
    const aborted = await deps.git(['rebase', '--abort'], repoPath)
    if (aborted instanceof Error) return aborted
  }

  if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
    deps.log('Aborting a half-finished merge')
    const aborted = await deps.git(['merge', '--abort'], repoPath)
    if (aborted instanceof Error) return aborted
  }
}

async function checkBranch(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  const current = await deps.git(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    config.repoPath
  )
  if (current instanceof Error) return current
  if (current !== config.branch) {
    return new Error(
      `The checkout is on '${current}', not '${config.branch}'. Empty the volume to change branch.`
    )
  }
}

async function fetchRemote(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  const setUrl = await deps.git(
    ['remote', 'set-url', 'origin', config.repoUrl],
    config.repoPath
  )
  if (setUrl instanceof Error) return setUrl
  const fetched = await deps.git(
    ['fetch', 'origin', config.branch],
    config.repoPath
  )
  if (fetched instanceof Error) return fetched
}

async function resetToRemote(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  deps.log(
    `New reset token. Discarding local commits: git reset --hard origin/${config.branch}`
  )
  const reset = await deps.git(
    ['reset', '--hard', `origin/${config.branch}`],
    config.repoPath
  )
  if (reset instanceof Error) return reset
  storeResetToken(config)
}

async function rebaseOntoRemote(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  const remoteRef = `origin/${config.branch}`
  // --autostash keeps a file that Strapi wrote but did not commit before it
  // stopped. The next save stages it.
  const rebased = await deps.git(
    ['rebase', '--autostash', remoteRef],
    config.repoPath
  )
  if (rebased instanceof Error) {
    await deps.git(['rebase', '--abort'], config.repoPath)
    return new Error(
      `Local commits conflict with ${remoteRef}. Resolve by hand in the checkout. No commit was discarded.`,
      { cause: rebased }
    )
  }

  // A conflict while git restores the autostash still exits 0. It leaves
  // conflict markers in the file, which the next save would commit. Git keeps
  // the stash.
  const unmerged = await deps.git(
    ['diff', '--name-only', '--diff-filter=U'],
    config.repoPath
  )
  if (unmerged instanceof Error) return unmerged
  if (unmerged !== '') {
    return new Error(
      `Uncommitted files conflict with ${remoteRef}. Git kept them in the stash (git stash list).`
    )
  }
}

async function pushLocalCommits(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  const countOutput = await deps.git(
    ['rev-list', '--count', `origin/${config.branch}..HEAD`],
    config.repoPath
  )
  if (countOutput instanceof Error) return countOutput
  const ahead = parseCommitCount(countOutput)
  if (ahead instanceof Error) return ahead
  if (ahead === 0) return

  if (config.gitSyncDisabled) {
    deps.log(
      `WARNING: ${ahead} local commit(s) are not pushed, because git sync is off`
    )
    return
  }
  deps.log(`Pushing ${ahead} local commit(s) to origin/${config.branch}`)
  const pushed = await deps.git(
    ['push', 'origin', `HEAD:${config.branch}`],
    config.repoPath
  )
  if (pushed instanceof Error) return pushed
}

async function updateCheckout(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void | Error> {
  const cleared = await clearInterruptedState(config.repoPath, deps)
  if (cleared instanceof Error) return cleared
  const onBranch = await checkBranch(config, deps)
  if (onBranch instanceof Error) return onBranch
  const fetched = await fetchRemote(config, deps)
  if (fetched instanceof Error) return fetched

  const storedToken = readStoredResetToken(config.repoPath)
  if (isNewResetToken(config.resetToken, storedToken)) {
    return resetToRemote(config, deps)
  }

  const rebased = await rebaseOntoRemote(config, deps)
  if (rebased instanceof Error) return rebased
  return pushLocalCommits(config, deps)
}

async function waitForDatabase(
  config: InitRepoConfig,
  deps: InitRepoDeps
): Promise<void> {
  const { databaseFile, dbPollSeconds } = config
  if (config.dbBootstrap !== 'wait' || fs.existsSync(databaseFile)) return

  let waitedSeconds = 0
  while (!fs.existsSync(databaseFile)) {
    if (isReminderDue(waitedSeconds)) {
      deps.log(
        `Waiting for ${databaseFile}. Copy it in, then rename it in place:`
      )
      deps.log(
        `  kubectl cp data.db <pod>:${databaseFile}.incoming -c prepare-repo`
      )
      deps.log(
        `  kubectl exec <pod> -c prepare-repo -- mv ${databaseFile}.incoming ${databaseFile}`
      )
    }
    await deps.sleep(dbPollSeconds * MS_PER_SECOND)
    waitedSeconds += dbPollSeconds
  }
  deps.log(`Found ${databaseFile}`)
}

// ── Entry ────────────────────────────────────────────────────────────────────

/** Prepares the checkout and the database folder. Resolves to the checked-out HEAD, e.g. `abc1234 subject`. */
export async function initRepo(
  config: InitRepoConfig,
  deps: InitRepoDeps = defaultInitRepoDeps
): Promise<string | Error> {
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true })

  const isCheckout = fs.existsSync(path.join(config.repoPath, '.git'))
  const prepared = isCheckout
    ? await updateCheckout(config, deps)
    : await cloneCheckout(config, deps)
  if (prepared instanceof Error) return prepared

  await waitForDatabase(config, deps)

  const head = await deps.git(['log', '-1', '--format=%h %s'], config.repoPath)
  if (head instanceof Error) return head
  deps.log(`Ready: ${head}`)
  return head
}
