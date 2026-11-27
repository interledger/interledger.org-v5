/**
 * Runs `sync:all` against a running Strapi, from a fresh clone of the branch.
 *
 * Runs as the content-sync Job, through `cms-sync-all`. The Job cannot mount the
 * Strapi volume, so it clones the branch into `repoPath`, an emptyDir. The sync
 * scripts then read the content from that clone through STRAPI_PROJECT_ROOT, and
 * run from the image's CMS folder.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { tryCatchAsync } from '../src/utils/tryCatch'
import { assertStrapiRunning } from './ensureStrapiRunning'
import { createGitRunner, type RunGit } from './initRepo'

/** Strapi can still be starting when the Job starts. */
const STRAPI_STARTUP_BUDGET_MS = 10 * 60 * 1000

/** The folder the sync scripts run from: this script's own CMS folder. */
const CMS_DIR = path.resolve(__dirname, '..')

export interface SyncAllFromCloneConfig {
  /** Repository to clone. */
  repoUrl: string
  /** Branch to sync from. */
  branch: string
  /** Folder for the clone. Its contents are deleted first. */
  repoPath: string
  /** The Strapi to sync into. */
  strapiUrl: string
  /** True: pass --force, which skips the sync scripts' branch check. */
  force: boolean
}

// ── Injected effects ─────────────────────────────────────────────────────────

export interface SyncAllFromCloneDeps {
  git: RunGit
  log: (message: string) => void
  waitForStrapi: (strapiUrl: string) => Promise<void | Error>
  /** Runs `pnpm run sync:all` with `args`, and returns its exit code. */
  runSyncAll: (args: string[], projectRoot: string) => number
}

export const defaultSyncAllFromCloneDeps: SyncAllFromCloneDeps = {
  git: createGitRunner(),
  log: (message) => console.log(`[cms-sync-all] ${message}`),
  waitForStrapi: (strapiUrl) =>
    tryCatchAsync(() =>
      assertStrapiRunning(strapiUrl, STRAPI_STARTUP_BUDGET_MS)
    ),
  runSyncAll: (args, projectRoot) => {
    const result = spawnSync('pnpm', ['run', 'sync:all', ...args], {
      cwd: CMS_DIR,
      stdio: 'inherit',
      env: { ...process.env, STRAPI_PROJECT_ROOT: projectRoot }
    })
    return result.status ?? 1
  }
}

// ── Configuration ────────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'GIT_REPO_URL',
  'GIT_BRANCH',
  'GIT_REPO_PATH',
  'STRAPI_URL',
  // Not read here. The sync scripts read it, and fail late without it.
  'STRAPI_API_TOKEN'
] as const

export function readSyncAllFromCloneConfig(
  env: NodeJS.ProcessEnv
): SyncAllFromCloneConfig | Error {
  const missing = REQUIRED_ENV.filter((name) => !env[name])
  if (missing.length > 0) {
    return new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
  return {
    repoUrl: env.GIT_REPO_URL!,
    branch: env.GIT_BRANCH!,
    repoPath: env.GIT_REPO_PATH!,
    strapiUrl: env.STRAPI_URL!,
    force: env.SYNC_FORCE === 'true'
  }
}

export function syncAllArgs(force: boolean): string[] {
  return force ? ['--force'] : []
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function cloneBranch(
  config: SyncAllFromCloneConfig,
  deps: SyncAllFromCloneDeps
): Promise<void | Error> {
  fs.rmSync(config.repoPath, { recursive: true, force: true })
  const parentDir = path.dirname(config.repoPath)
  fs.mkdirSync(parentDir, { recursive: true })

  deps.log(`Cloning ${config.branch} from ${config.repoUrl}`)
  const cloned = await deps.git(
    [
      'clone',
      '--depth',
      '1',
      '--branch',
      config.branch,
      config.repoUrl,
      config.repoPath
    ],
    parentDir
  )
  if (cloned instanceof Error) return cloned

  const head = await deps.git(['log', '-1', '--format=%h %s'], config.repoPath)
  if (head instanceof Error) return head
  deps.log(`Syncing from ${head}`)
}

// ── Entry ────────────────────────────────────────────────────────────────────

/** Resolves to the exit code of `sync:all`, or an Error when it never ran. */
export async function syncAllFromClone(
  config: SyncAllFromCloneConfig,
  deps: SyncAllFromCloneDeps = defaultSyncAllFromCloneDeps
): Promise<number | Error> {
  const healthy = await deps.waitForStrapi(config.strapiUrl)
  if (healthy instanceof Error) return healthy

  const cloned = await cloneBranch(config, deps)
  if (cloned instanceof Error) return cloned

  return deps.runSyncAll(syncAllArgs(config.force), config.repoPath)
}
