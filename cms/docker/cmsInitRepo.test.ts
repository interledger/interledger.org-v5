/**
 * Runs docker/cms-init-repo against real git repositories in a temp folder.
 *
 * `origin.git` is a bare repository that stands in for GitHub. `upstream` is a
 * second clone that pushes the commits another editor or a developer would make.
 * `volume/repo` is the checkout the script manages.
 */
import { execFileSync, spawn, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = path.resolve(__dirname, 'cms-init-repo')
const BRANCH = 'staging'

let root: string
let originUrl: string
let upstream: string
let checkout: string
let databaseFile: string

/** Git config isolated from the developer's own, and an identity for commits. */
function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: root,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.org',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.org'
  }
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function commitFile(repo: string, file: string, content: string): string {
  fs.writeFileSync(path.join(repo, file), content)
  git(repo, 'add', file)
  git(repo, 'commit', '-q', '-m', `edit ${file}`)
  return git(repo, 'rev-parse', 'HEAD')
}

function pushUpstream(file: string, content: string): string {
  const sha = commitFile(upstream, file, content)
  git(upstream, 'push', '-q', 'origin', BRANCH)
  return sha
}

function scriptEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...gitEnv(),
    GIT_REPO_URL: originUrl,
    GIT_BRANCH: BRANCH,
    GIT_REPO_PATH: checkout,
    DATABASE_FILENAME: databaseFile,
    DB_BOOTSTRAP: 'create',
    STRAPI_DISABLE_GIT_SYNC: 'false',
    RESET_TOKEN: '',
    ...overrides
  }
}

function runInit(overrides: Record<string, string> = {}) {
  const result = spawnSync('sh', [SCRIPT], {
    env: scriptEnv(overrides),
    encoding: 'utf-8'
  })
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`
  }
}

function originHead(): string {
  return git(root, '--git-dir', path.join(root, 'origin.git'), 'rev-parse', BRANCH)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-init-repo-'))
  originUrl = path.join(root, 'origin.git')
  upstream = path.join(root, 'upstream')
  checkout = path.join(root, 'volume', 'repo')
  databaseFile = path.join(root, 'volume', 'db', 'data.db')

  git(root, 'init', '-q', '--bare', '-b', BRANCH, originUrl)
  git(root, 'clone', '-q', originUrl, upstream)
  git(upstream, 'checkout', '-q', '-b', BRANCH)
  pushUpstream('README.md', 'first\n')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('cms-init-repo on an empty volume', () => {
  it('clones the branch and creates the database folder', () => {
    const { status } = runInit()

    expect(status).toBe(0)
    expect(git(checkout, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(BRANCH)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(originHead())
    expect(fs.existsSync(path.dirname(databaseFile))).toBe(true)
  })

  it('stores the reset token, so the next start does not reset again', () => {
    runInit({ RESET_TOKEN: 'run-1' })
    const localSha = commitFile(checkout, 'unpushed.md', 'local\n')

    const { status } = runInit({ RESET_TOKEN: 'run-1', STRAPI_DISABLE_GIT_SYNC: 'true' })

    expect(status).toBe(0)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })

  it('refuses a folder that holds files but is not a checkout', () => {
    fs.mkdirSync(checkout, { recursive: true })
    fs.writeFileSync(path.join(checkout, 'stray.txt'), 'x')

    const { status, output } = runInit()

    expect(status).toBe(1)
    expect(output).toContain('is not empty and is not a git checkout')
  })
})

describe('cms-init-repo on a used volume', () => {
  beforeEach(() => {
    expect(runInit().status).toBe(0)
  })

  it('fast-forwards to commits pushed by someone else', () => {
    const upstreamSha = pushUpstream('page.md', 'from a developer\n')

    expect(runInit().status).toBe(0)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(upstreamSha)
  })

  it('pushes local commits that never reached the remote', () => {
    const localSha = commitFile(checkout, 'blog.md', 'saved by an editor\n')

    const { status, output } = runInit()

    expect(status).toBe(0)
    expect(output).toContain('Pushing 1 local commit(s)')
    expect(originHead()).toBe(localSha)
  })

  it('keeps local commits unpushed while git sync is off', () => {
    const remoteBefore = originHead()
    commitFile(checkout, 'blog.md', 'saved by an editor\n')

    const { status, output } = runInit({ STRAPI_DISABLE_GIT_SYNC: 'true' })

    expect(status).toBe(0)
    expect(output).toContain('are not pushed, because git sync is off')
    expect(originHead()).toBe(remoteBefore)
  })

  it('rebases local commits onto new remote commits, then pushes both', () => {
    const upstreamSha = pushUpstream('page.md', 'from a developer\n')
    commitFile(checkout, 'blog.md', 'saved by an editor\n')

    expect(runInit().status).toBe(0)
    expect(git(checkout, 'rev-parse', 'HEAD~1')).toBe(upstreamSha)
    expect(originHead()).toBe(git(checkout, 'rev-parse', 'HEAD'))
  })

  it('stops on a conflict and keeps the local commit', () => {
    pushUpstream('README.md', 'remote change\n')
    const localSha = commitFile(checkout, 'README.md', 'local change\n')

    const { status, output } = runInit()

    expect(status).toBe(1)
    expect(output).toContain('Local commits conflict')
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(false)
  })

  it('keeps a file Strapi wrote but did not commit', () => {
    pushUpstream('page.md', 'from a developer\n')
    fs.writeFileSync(path.join(checkout, 'uncommitted.md'), 'written before the pod stopped\n')

    expect(runInit().status).toBe(0)
    expect(fs.readFileSync(path.join(checkout, 'uncommitted.md'), 'utf-8')).toBe(
      'written before the pod stopped\n'
    )
  })

  it('stops when an uncommitted change conflicts with the remote', () => {
    pushUpstream('README.md', 'remote change\n')
    fs.writeFileSync(path.join(checkout, 'README.md'), 'uncommitted change\n')

    const { status, output } = runInit()

    expect(status).toBe(1)
    expect(output).toContain('Uncommitted files conflict')
    expect(git(checkout, 'stash', 'list')).not.toBe('')
  })

  it('removes a stale index.lock left by a killed git process', () => {
    fs.writeFileSync(path.join(checkout, '.git', 'index.lock'), '')
    pushUpstream('page.md', 'from a developer\n')

    const { status, output } = runInit()

    expect(status).toBe(0)
    expect(output).toContain('Removed stale lock')
    expect(fs.existsSync(path.join(checkout, '.git', 'index.lock'))).toBe(false)
  })

  it('aborts a rebase that a killed pod left half-finished', () => {
    pushUpstream('README.md', 'remote change\n')
    const localSha = commitFile(checkout, 'README.md', 'local change\n')
    git(checkout, 'fetch', '-q', 'origin')
    spawnSync('git', ['rebase', `origin/${BRANCH}`], { cwd: checkout, env: gitEnv() })
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(true)

    const { output } = runInit()

    expect(output).toContain('Aborting a half-finished rebase')
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(false)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })

  it('refuses a checkout on another branch', () => {
    git(checkout, 'checkout', '-q', '-b', 'cms-k8s-shadow')

    const { status, output } = runInit()

    expect(status).toBe(1)
    expect(output).toContain("The checkout is on 'cms-k8s-shadow', not 'staging'")
  })

  it('hard-resets to the remote branch on a new reset token', () => {
    commitFile(checkout, 'blog.md', 'discarded by a Force Reset\n')

    const { status } = runInit({ RESET_TOKEN: 'force-reset-1', STRAPI_DISABLE_GIT_SYNC: 'true' })

    expect(status).toBe(0)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(originHead())
  })

  it('does not reset a second time for the same token', () => {
    runInit({ RESET_TOKEN: 'force-reset-1' })
    const localSha = commitFile(checkout, 'blog.md', 'saved after the reset\n')

    runInit({ RESET_TOKEN: 'force-reset-1', STRAPI_DISABLE_GIT_SYNC: 'true' })

    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })
})

describe('cms-init-repo database bootstrap', () => {
  it('waits until the database file exists', async () => {
    const child = spawn('sh', [SCRIPT], {
      env: scriptEnv({ DB_BOOTSTRAP: 'wait', DB_POLL_SECONDS: '1' })
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))

    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(child.exitCode).toBeNull()
    fs.writeFileSync(databaseFile, '')

    expect(await exited).toBe(0)
    expect(output).toContain(`Waiting for ${databaseFile}`)
    expect(output).toContain(`Found ${databaseFile}`)
  }, 15_000)

  it('does not wait when the database file already exists', () => {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true })
    fs.writeFileSync(databaseFile, '')

    const { status, output } = runInit({ DB_BOOTSTRAP: 'wait' })

    expect(status).toBe(0)
    expect(output).not.toContain('Waiting for')
  })
})
