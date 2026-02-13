import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'

function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

function expandHomeDir(filepath: string): string {
  if (!filepath.startsWith('~/')) return filepath
  return path.join(os.homedir(), filepath.slice(2))
}

export function getTargetRepoRoot(): string {
  const configuredPath =
    process.env.STRAPI_GIT_SYNC_REPO_PATH || '~/interledger.org-v5-staging'
  return path.resolve(expandHomeDir(configuredPath))
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
  if (branch !== 'staging') {
    throw new Error(
      `Git sync repository must be on "staging" branch, found "${branch}" at ${targetRepoRoot}`
    )
  }

  console.log(
    `✅ Git sync repository validated: ${targetRepoRoot} (branch: ${branch})`
  )
}

/**
 * Pulls latest changes, stages the filepath, commits, and pushes.
 * Resolves even on failure so Strapi saves content.
 */
export async function gitCommitAndPush(
  filepath: string,
  message: string
): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync disabled via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  const projectRoot = getTargetRepoRoot()
  const safeMessage = escapeForShell(message)

  const relativeFilepath = path.isAbsolute(filepath)
    ? path.relative(projectRoot, filepath)
    : filepath
  const safeFilepath = escapeForShell(relativeFilepath)

  // Always include public/uploads if it exists so media changes are committed
  const uploadsDir = path.join(projectRoot, 'public', 'uploads')
  const addPaths = [safeFilepath]
  if (fs.existsSync(uploadsDir)) {
    const uploadsRelative = escapeForShell(
      path.relative(projectRoot, uploadsDir)
    )
    addPaths.push(uploadsRelative)
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
