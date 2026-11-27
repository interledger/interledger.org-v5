/**
 * The decisions are tested as pure functions. The git behaviour is tested against
 * real repositories in a temp folder, because rebase, autostash and lock files
 * are exactly what a fake would get wrong.
 *
 * `origin.git` is a bare repository that stands in for GitHub. `upstream` is a
 * second clone that pushes the commits another editor or a developer would make.
 * `volume/repo` is the checkout the script manages.
 */
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createGitRunner,
  findLockFiles,
  initRepo,
  isNewResetToken,
  isReminderDue,
  parseCommitCount,
  readInitRepoConfig,
  type InitRepoConfig,
  type InitRepoDeps
} from './initRepo'

const BRANCH = 'staging'

describe('readInitRepoConfig', () => {
  const required = {
    GIT_REPO_URL: 'https://example.org/repo.git',
    GIT_BRANCH: BRANCH,
    GIT_REPO_PATH: '/data/repo',
    DATABASE_FILENAME: '/data/db/data.db'
  }

  it('applies the defaults', () => {
    expect(readInitRepoConfig(required)).toEqual({
      repoUrl: required.GIT_REPO_URL,
      branch: BRANCH,
      repoPath: '/data/repo',
      databaseFile: '/data/db/data.db',
      dbBootstrap: 'wait',
      gitSyncDisabled: false,
      resetToken: '',
      dbPollSeconds: 5
    })
  })

  it('reads the optional settings', () => {
    const config = readInitRepoConfig({
      ...required,
      DB_BOOTSTRAP: 'create',
      STRAPI_DISABLE_GIT_SYNC: 'true',
      RESET_TOKEN: 'run-1',
      DB_POLL_SECONDS: '2'
    })

    expect(config).toMatchObject({
      dbBootstrap: 'create',
      gitSyncDisabled: true,
      resetToken: 'run-1',
      dbPollSeconds: 2
    })
  })

  it('names every missing variable', () => {
    const config = readInitRepoConfig({ GIT_BRANCH: BRANCH })

    expect(config).toBeInstanceOf(Error)
    expect((config as Error).message).toBe(
      'Missing environment variables: GIT_REPO_URL, GIT_REPO_PATH, DATABASE_FILENAME'
    )
  })

  it('treats an empty variable as missing', () => {
    expect(readInitRepoConfig({ ...required, GIT_BRANCH: '' })).toBeInstanceOf(
      Error
    )
  })

  it('rejects an unknown DB_BOOTSTRAP', () => {
    const config = readInitRepoConfig({ ...required, DB_BOOTSTRAP: 'creat' })

    expect((config as Error).message).toContain("not 'creat'")
  })

  it.each(['0', '-1', '1.5', 'five'])('rejects DB_POLL_SECONDS=%s', (value) => {
    expect(
      readInitRepoConfig({ ...required, DB_POLL_SECONDS: value })
    ).toBeInstanceOf(Error)
  })
})

describe('isNewResetToken', () => {
  it('never resets without a token', () => {
    expect(isNewResetToken('', null)).toBe(false)
    expect(isNewResetToken('', 'run-1')).toBe(false)
  })

  it('resets for a token the volume has not stored', () => {
    expect(isNewResetToken('run-1', null)).toBe(true)
    expect(isNewResetToken('run-2', 'run-1')).toBe(true)
  })

  it('does not reset twice for the same token', () => {
    expect(isNewResetToken('run-1', 'run-1')).toBe(false)
  })
})

describe('isReminderDue', () => {
  it('reminds at the first check and once a minute after', () => {
    expect([0, 5, 55, 60, 65, 120].map(isReminderDue)).toEqual([
      true,
      false,
      false,
      true,
      false,
      true
    ])
  })
})

describe('parseCommitCount', () => {
  it('parses a count', () => {
    expect(parseCommitCount('0')).toBe(0)
    expect(parseCommitCount('3')).toBe(3)
  })

  it.each(['', 'abc', '-1', '1.5'])('rejects %j', (output) => {
    expect(parseCommitCount(output)).toBeInstanceOf(Error)
  })
})

// ── Against real git repositories ────────────────────────────────────────────

let root: string
let originUrl: string
let upstream: string
let checkout: string
let databaseFile: string
let logs: string[]

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

function originHead(): string {
  return git(root, '--git-dir', originUrl, 'rev-parse', BRANCH)
}

function testConfig(overrides: Partial<InitRepoConfig> = {}): InitRepoConfig {
  return {
    repoUrl: originUrl,
    branch: BRANCH,
    repoPath: checkout,
    databaseFile,
    dbBootstrap: 'create',
    gitSyncDisabled: false,
    resetToken: '',
    dbPollSeconds: 5,
    ...overrides
  }
}

function testDeps(overrides: Partial<InitRepoDeps> = {}): InitRepoDeps {
  return {
    git: createGitRunner(gitEnv()),
    log: (message) => logs.push(message),
    sleep: async () => {},
    ...overrides
  }
}

function runInit(overrides: Partial<InitRepoConfig> = {}) {
  return initRepo(testConfig(overrides), testDeps())
}

function errorMessage(result: string | Error): string {
  expect(result).toBeInstanceOf(Error)
  return (result as Error).message
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-init-repo-'))
  originUrl = path.join(root, 'origin.git')
  upstream = path.join(root, 'upstream')
  checkout = path.join(root, 'volume', 'repo')
  databaseFile = path.join(root, 'volume', 'db', 'data.db')
  logs = []

  git(root, 'init', '-q', '--bare', '-b', BRANCH, originUrl)
  git(root, 'clone', '-q', originUrl, upstream)
  git(upstream, 'checkout', '-q', '-b', BRANCH)
  pushUpstream('README.md', 'first\n')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('initRepo on an empty volume', () => {
  it('clones the branch and creates the database folder', async () => {
    const result = await runInit()

    expect(result).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(BRANCH)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(originHead())
    expect(fs.existsSync(path.dirname(databaseFile))).toBe(true)
    expect(logs.at(-1)).toMatch(/^Ready: [0-9a-f]+ edit README\.md$/)
  })

  it('stores the reset token, so the next start does not reset again', async () => {
    await runInit({ resetToken: 'run-1' })
    const localSha = commitFile(checkout, 'unpushed.md', 'local\n')

    const result = await runInit({
      resetToken: 'run-1',
      gitSyncDisabled: true
    })

    expect(result).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })

  it('refuses a folder that holds files but is not a checkout', async () => {
    fs.mkdirSync(checkout, { recursive: true })
    fs.writeFileSync(path.join(checkout, 'stray.txt'), 'x')

    expect(errorMessage(await runInit())).toContain(
      'is not empty and is not a git checkout'
    )
  })

  it('clones into an existing empty folder', async () => {
    fs.mkdirSync(checkout, { recursive: true })

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(originHead())
  })

  it('returns the git error when the clone fails', async () => {
    const result = await runInit({ repoUrl: path.join(root, 'missing.git') })

    expect(errorMessage(result)).toContain('git clone')
  })
})

describe('initRepo on a used volume', () => {
  beforeEach(async () => {
    expect(await runInit()).not.toBeInstanceOf(Error)
    logs = []
  })

  it('fast-forwards to commits pushed by someone else', async () => {
    const upstreamSha = pushUpstream('page.md', 'from a developer\n')

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(upstreamSha)
  })

  it('pushes local commits that never reached the remote', async () => {
    const localSha = commitFile(checkout, 'blog.md', 'saved by an editor\n')

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(logs).toContain(`Pushing 1 local commit(s) to origin/${BRANCH}`)
    expect(originHead()).toBe(localSha)
  })

  it('keeps local commits unpushed while git sync is off', async () => {
    const remoteBefore = originHead()
    commitFile(checkout, 'blog.md', 'saved by an editor\n')

    expect(await runInit({ gitSyncDisabled: true })).not.toBeInstanceOf(Error)
    expect(logs.join('\n')).toContain('are not pushed, because git sync is off')
    expect(originHead()).toBe(remoteBefore)
  })

  it('rebases local commits onto new remote commits, then pushes both', async () => {
    const upstreamSha = pushUpstream('page.md', 'from a developer\n')
    commitFile(checkout, 'blog.md', 'saved by an editor\n')

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', 'HEAD~1')).toBe(upstreamSha)
    expect(originHead()).toBe(git(checkout, 'rev-parse', 'HEAD'))
  })

  it('returns the git error when the push is rejected', async () => {
    commitFile(checkout, 'blog.md', 'saved by an editor\n')
    fs.writeFileSync(
      path.join(originUrl, 'hooks', 'pre-receive'),
      '#!/bin/sh\nexit 1\n',
      { mode: 0o755 }
    )

    expect(errorMessage(await runInit())).toContain('git push')
  })

  it('stops on a conflict and keeps the local commit', async () => {
    pushUpstream('README.md', 'remote change\n')
    const localSha = commitFile(checkout, 'README.md', 'local change\n')

    expect(errorMessage(await runInit())).toContain('Local commits conflict')
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(
      false
    )
  })

  it('keeps a file Strapi wrote but did not commit', async () => {
    pushUpstream('page.md', 'from a developer\n')
    fs.writeFileSync(
      path.join(checkout, 'uncommitted.md'),
      'written before the pod stopped\n'
    )

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(
      fs.readFileSync(path.join(checkout, 'uncommitted.md'), 'utf-8')
    ).toBe('written before the pod stopped\n')
  })

  it('stops when an uncommitted change conflicts with the remote', async () => {
    pushUpstream('README.md', 'remote change\n')
    fs.writeFileSync(path.join(checkout, 'README.md'), 'uncommitted change\n')

    expect(errorMessage(await runInit())).toContain(
      'Uncommitted files conflict'
    )
    expect(git(checkout, 'stash', 'list')).not.toBe('')
  })

  it('removes stale lock files left by a killed git process', async () => {
    fs.writeFileSync(path.join(checkout, '.git', 'index.lock'), '')
    const refLock = path.join(checkout, '.git', 'refs', 'heads', 'x.lock')
    fs.writeFileSync(refLock, '')
    pushUpstream('page.md', 'from a developer\n')

    expect(await runInit()).not.toBeInstanceOf(Error)
    expect(logs).toContain('Removed stale lock: .git/index.lock')
    expect(fs.existsSync(path.join(checkout, '.git', 'index.lock'))).toBe(false)
    expect(fs.existsSync(refLock)).toBe(false)
  })

  it('aborts a rebase that a killed pod left half-finished', async () => {
    pushUpstream('README.md', 'remote change\n')
    const localSha = commitFile(checkout, 'README.md', 'local change\n')
    git(checkout, 'fetch', '-q', 'origin')
    spawnSync('git', ['rebase', `origin/${BRANCH}`], {
      cwd: checkout,
      env: gitEnv()
    })
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(
      true
    )

    await runInit()

    expect(logs).toContain('Aborting a half-finished rebase')
    expect(fs.existsSync(path.join(checkout, '.git', 'rebase-merge'))).toBe(
      false
    )
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })

  it('aborts a merge that a killed pod left half-finished', async () => {
    pushUpstream('README.md', 'remote change\n')
    commitFile(checkout, 'README.md', 'local change\n')
    git(checkout, 'fetch', '-q', 'origin')
    spawnSync('git', ['merge', `origin/${BRANCH}`], {
      cwd: checkout,
      env: gitEnv()
    })
    expect(fs.existsSync(path.join(checkout, '.git', 'MERGE_HEAD'))).toBe(true)

    await runInit()

    expect(logs).toContain('Aborting a half-finished merge')
    expect(fs.existsSync(path.join(checkout, '.git', 'MERGE_HEAD'))).toBe(false)
  })

  it('refuses a checkout on another branch', async () => {
    git(checkout, 'checkout', '-q', '-b', 'cms-k8s-shadow')

    expect(errorMessage(await runInit())).toContain(
      "The checkout is on 'cms-k8s-shadow', not 'staging'"
    )
  })

  it('hard-resets to the remote branch on a new reset token', async () => {
    commitFile(checkout, 'blog.md', 'discarded by a Force Reset\n')

    const result = await runInit({
      resetToken: 'force-reset-1',
      gitSyncDisabled: true
    })

    expect(result).not.toBeInstanceOf(Error)
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(originHead())
  })

  it('does not reset a second time for the same token', async () => {
    await runInit({ resetToken: 'force-reset-1' })
    const localSha = commitFile(checkout, 'blog.md', 'saved after the reset\n')

    await runInit({ resetToken: 'force-reset-1', gitSyncDisabled: true })

    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(localSha)
  })
})

describe('findLockFiles', () => {
  it('finds nothing in a clean checkout', async () => {
    await runInit()

    expect(findLockFiles(checkout)).toEqual([])
  })
})

describe('initRepo database bootstrap', () => {
  it('waits until the database file exists, reminding once a minute', async () => {
    const pollSeconds = 30
    let polls = 0
    const sleep = async () => {
      polls++
      // Three polls of 30s: reminders at 0s and 60s.
      if (polls === 3) fs.writeFileSync(databaseFile, '')
    }

    const result = await initRepo(
      testConfig({ dbBootstrap: 'wait', dbPollSeconds: pollSeconds }),
      testDeps({ sleep })
    )

    expect(result).not.toBeInstanceOf(Error)
    expect(polls).toBe(3)
    expect(
      logs.filter((line) => line.startsWith(`Waiting for ${databaseFile}`))
    ).toHaveLength(2)
    expect(logs).toContain(`Found ${databaseFile}`)
  })

  it('does not wait when the database file already exists', async () => {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true })
    fs.writeFileSync(databaseFile, '')

    expect(await runInit({ dbBootstrap: 'wait' })).not.toBeInstanceOf(Error)
    expect(logs.join('\n')).not.toContain('Waiting for')
  })
})
