import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { getProjectRoot } from './paths'

const STAGE_CANDIDATES = [
  'src/content/',
  'src/data/',
  'public/uploads'
] as const
const CONTENT_PATH_PREFIXES = ['src/content/', 'src/data/'] as const
const DEBOUNCE_MS = 300

interface GitStatusChange {
  status: string
  filepath: string
}

function shellEscape(value: string): string {
  return value.replace(/'/g, "'\\''")
}

function shellQuote(value: string): string {
  return `'${shellEscape(value)}'`
}

function expandHomeDir(filepath: string): string {
  return filepath.startsWith('~/')
    ? path.join(os.homedir(), filepath.slice(2))
    : filepath
}

function execInRepo(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr?.trim() || error.message))
      else resolve(stdout.trim())
    })
  })
}

function toGitPath(repoRoot: string, filepath: string): string | null {
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

export function getTargetRepoRoot(): string {
  const configured = process.env.STRAPI_GIT_SYNC_REPO_PATH
  return configured ? path.resolve(expandHomeDir(configured)) : getProjectRoot()
}

export function resolveTargetRepoPath(targetPath: string): string {
  const expanded = expandHomeDir(targetPath)
  if (path.isAbsolute(expanded)) return path.resolve(expanded)
  return path.join(getTargetRepoRoot(), expanded.replace(/^\/+/, ''))
}

// ── Startup validation ───────────────────────────────────────────────────────

export async function validateGitSyncRepoOnStartup(): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync validation skipped via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  const repoRoot = getTargetRepoRoot()

  if (!fs.existsSync(repoRoot)) {
    throw new Error(
      `Git sync repository path does not exist: ${repoRoot}. ` +
        `Set STRAPI_GIT_SYNC_REPO_PATH or create the staging clone.`
    )
  }

  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    throw new Error(`Git sync repository is not a git checkout: ${repoRoot}`)
  }

  const branch = await execInRepo('git rev-parse --abbrev-ref HEAD', repoRoot)
  console.log(
    `✅ Git sync repository validated: ${repoRoot} (branch: ${branch})`
  )
}

// ── Git status + commit message inference ───────────────────────────────────

function parseGitStatusLine(line: string): GitStatusChange | null {
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

async function getGitStatus(cwd: string): Promise<GitStatusChange[]> {
  try {
    const output = await execInRepo('git status --porcelain', cwd)
    if (!output) return []
    return output
      .split('\n')
      .map(parseGitStatusLine)
      .filter((change): change is GitStatusChange => Boolean(change))
  } catch {
    return []
  }
}

function extractSlug(filepath: string): string {
  const basename = path.basename(filepath, path.extname(filepath))
  const dateMatch = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return dateMatch ? dateMatch[1] : basename
}

function inferCommitMessage(label: string, changes: GitStatusChange[]): string {
  const contentChanges = changes.filter((c) =>
    CONTENT_PATH_PREFIXES.some((prefix) => c.filepath.startsWith(prefix))
  )

  if (contentChanges.length === 0) return `${label}: sync`

  const deleted = contentChanges.filter((c) => isDeleted(c.status))
  const added = contentChanges.filter((c) => isAdded(c.status))
  const modified = contentChanges.filter((c) => isModified(c.status))

  if (contentChanges.length === 1) {
    const [change] = contentChanges
    const slug = extractSlug(change.filepath)
    if (isDeleted(change.status)) return `${label}: delete ${slug}`
    if (isModified(change.status)) return `${label}: update ${slug}`
    return `${label}: create ${slug}`
  }

  const deletedSlugs = [...new Set(deleted.map((c) => extractSlug(c.filepath)))]
  const addedSlugs = [...new Set(added.map((c) => extractSlug(c.filepath)))]

  // Rename: 1 delete + 1 add with different slugs
  if (deleted.length === 1 && added.length === 1 && modified.length === 0) {
    if (deletedSlugs[0] !== addedSlugs[0]) {
      return `${label}: rename ${deletedSlugs[0]} -> ${addedSlugs[0]}`
    }
  }

  // Re-slug as update: 1 delete + 1 add with same slug
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

function getStagePaths(repoRoot: string): string[] {
  const stagePaths = STAGE_CANDIDATES.filter((p) =>
    fs.existsSync(path.join(repoRoot, p))
  )
  return quoteGitPaths(stagePaths)
}

async function commitAndPush(
  repoRoot: string,
  addPaths: string[],
  message: string
): Promise<void> {
  const safeMessage = shellQuote(message)
  const commands = [
    `git add ${addPaths.join(' ')}`,
    `git commit -m ${safeMessage}`,
    'git pull --rebase',
    'git push'
  ].join(' && ')

  return new Promise((resolve) => {
    exec(commands, { cwd: repoRoot }, (error, stdout, stderr) => {
      if (error) {
        const combined = `${stdout ?? ''}\n${stderr ?? ''}`
        if (combined.includes('nothing to commit')) {
          console.log(`[gitSync] Nothing to commit`)
        } else {
          console.error(`⚠️  Git sync failed: ${error.message}`)
          if (stderr) console.error(`stderr: ${stderr}`)
        }
      } else {
        console.log(`✅ Git sync complete: ${message}`)
        if (stdout) console.log(stdout)
      }
      resolve()
    })
  })
}

// ── Debounced sync ───────────────────────────────────────────────────────────

let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null

async function flushGitSync(label: string): Promise<void> {
  const repoRoot = getTargetRepoRoot()
  const changes = await getGitStatus(repoRoot)

  if (changes.length === 0) {
    console.log(`[gitSync] No changes to commit`)
    return
  }

  const stagePaths = getStagePaths(repoRoot)
  if (stagePaths.length === 0) {
    console.log(`[gitSync] No content directories to stage`)
    return
  }

  const message = inferCommitMessage(label, changes)
  console.log(`[gitSync] Inferred message: ${message}`)
  await commitAndPush(repoRoot, stagePaths, message)
}

/**
 * Schedule a debounced git sync. Multiple calls within {@link DEBOUNCE_MS}
 * are coalesced into a single commit. The commit message is inferred from
 * actual git status rather than the caller.
 */
export function scheduleGitSync(label: string): void {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync scheduling skipped via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  if (pendingSyncTimer) clearTimeout(pendingSyncTimer)

  pendingSyncTimer = setTimeout(() => {
    pendingSyncTimer = null
    flushGitSync(label).catch((err) =>
      console.error(`[gitSync] Flush error:`, err)
    )
  }, DEBOUNCE_MS)
}

/**
 * Commit specific files immediately with an explicit message.
 * Use for cases like navigation updates where status inference isn't needed.
 */
export async function gitCommitAndPush(
  filepath: string | string[],
  message: string
): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync commit skipped via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  const repoRoot = getTargetRepoRoot()
  const rawPaths = Array.isArray(filepath) ? filepath : [filepath]
  const normalizedPaths = rawPaths
    .map((fp) => toGitPath(repoRoot, fp))
    .filter((p): p is string => Boolean(p))

  const uploadsDir = path.join(repoRoot, 'public', 'uploads')
  if (fs.existsSync(uploadsDir)) {
    const uploadsPath = toGitPath(repoRoot, uploadsDir)
    if (uploadsPath) normalizedPaths.push(uploadsPath)
  }

  const paths = quoteGitPaths(normalizedPaths)
  if (paths.length === 0) {
    console.log('[gitSync] No valid paths to stage')
    return
  }

  await commitAndPush(repoRoot, paths, message)
}
