import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { getProjectRoot } from './paths'

function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

function expandHomeDir(filepath: string): string {
  if (!filepath.startsWith('~/')) return filepath
  return path.join(os.homedir(), filepath.slice(2))
}

export function getTargetRepoRoot(): string {
  const configuredPath = process.env.STRAPI_GIT_SYNC_REPO_PATH
  if (configuredPath) {
    return path.resolve(expandHomeDir(configuredPath))
  }
  // Default: use project root so commits go to the same repo where MDX is written
  return getProjectRoot()
}

export function resolveTargetRepoPath(targetPath: string): string {
  const expandedPath = expandHomeDir(targetPath)

  if (path.isAbsolute(expandedPath)) {
    return path.resolve(expandedPath)
  }

  const normalizedRelativePath = expandedPath.replace(/^\/+/, '')
  return path.join(getTargetRepoRoot(), normalizedRelativePath)
}

function execInRepo(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message))
        return
      }
      resolve(stdout.trim())
    })
  })
}

export async function validateGitSyncRepoOnStartup(): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync validation skipped via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  const targetRepoRoot = getTargetRepoRoot()
  const gitDir = path.join(targetRepoRoot, '.git')
  const usingStagingRepo = Boolean(process.env.STRAPI_GIT_SYNC_REPO_PATH)

  if (!fs.existsSync(targetRepoRoot)) {
    throw new Error(
      `Git sync repository path does not exist: ${targetRepoRoot}. ` +
        'Set STRAPI_GIT_SYNC_REPO_PATH or create the staging clone.'
    )
  }

  if (!fs.existsSync(gitDir)) {
    throw new Error(
      `Git sync repository is not a git checkout: ${targetRepoRoot}`
    )
  }

  const branch = await execInRepo(
    'git rev-parse --abbrev-ref HEAD',
    targetRepoRoot
  )

  if (usingStagingRepo && branch !== 'staging') {
    throw new Error(
      `Git sync repository must be on "staging" branch, found "${branch}" at ${targetRepoRoot}`
    )
  }

  console.log(
    `✅ Git sync repository validated: ${targetRepoRoot} (branch: ${branch})`
  )
}

const DEBOUNCE_MS = 2000

interface PendingCommit {
  paths: Set<string>
  messages: string[]
  timeout: ReturnType<typeof setTimeout>
}

let pendingCommit: PendingCommit | null = null

function flushPendingCommit(): void {
  if (!pendingCommit || pendingCommit.paths.size === 0) {
    pendingCommit = null
    return
  }
  const { paths, messages } = pendingCommit
  pendingCommit = null
  const pathsArray = Array.from(paths)
  const message =
    messages.length === 1
      ? messages[0]
      : messages[messages.length - 1].replace(
          /^(foundation-page|summit-page): (create|update|delete) /,
          '$1: sync '
        )
  gitCommitAndPushImmediate(pathsArray, message)
}

function scheduleDebouncedCommit(
  filepath: string | string[],
  message: string
): void {
  const paths = Array.isArray(filepath) ? filepath : [filepath]
  if (paths.length === 0) return

  const projectRoot = getTargetRepoRoot()
  const normalizedPaths = paths.map((fp) =>
    path.isAbsolute(fp) ? fp : path.join(projectRoot, fp)
  )

  if (pendingCommit) {
    clearTimeout(pendingCommit.timeout)
    normalizedPaths.forEach((p) => pendingCommit!.paths.add(p))
    pendingCommit.messages.push(message)
  } else {
    pendingCommit = {
      paths: new Set(normalizedPaths),
      messages: [message],
      timeout: null as unknown as ReturnType<typeof setTimeout>
    }
  }

  pendingCommit.timeout = setTimeout(() => {
    flushPendingCommit()
  }, DEBOUNCE_MS)
}

function gitCommitAndPushImmediate(
  filepath: string | string[],
  message: string
): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync disabled via STRAPI_DISABLE_GIT_SYNC')
    return Promise.resolve()
  }

  const paths = Array.isArray(filepath) ? filepath : [filepath]
  if (paths.length === 0) return Promise.resolve()

  const projectRoot = getTargetRepoRoot()
  const safeMessage = escapeForShell(message)

  const addPaths = paths.map((fp) => {
    const relative = path.isAbsolute(fp)
      ? path.relative(projectRoot, fp)
      : fp
    return escapeForShell(relative)
  })

  const uploadsDir = path.join(projectRoot, 'public', 'uploads')
  if (fs.existsSync(uploadsDir)) {
    addPaths.push(
      escapeForShell(path.relative(projectRoot, uploadsDir))
    )
  }

  return new Promise((resolve) => {
    const commands = [
      `git add ${addPaths.map((p) => `'${p}'`).join(' ')}`,
      `git commit -m '${safeMessage}'`,
      'git pull --rebase',
      'git push'
    ].join(' && ')

    exec(commands, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(`⚠️  Git sync failed: ${error.message}`)
        if (stderr) console.error(`stderr: ${stderr}`)
        resolve()
        return
      }
      console.log(`✅ Git sync complete: ${message}`)
      if (stdout) console.log(stdout)
      resolve()
    })
  })
}

/**
 * Schedules a debounced git commit. Multiple rapid calls (e.g. from Strapi
 * update→delete→create lifecycle chain) are coalesced into a single commit.
 */
export async function gitCommitAndPush(
  filepath: string | string[],
  message: string
): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync disabled via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  scheduleDebouncedCommit(filepath, message)
}
