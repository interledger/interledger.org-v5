import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectRoot } from './paths'
import {
  GitCommandError,
  buildAddCommand,
  buildCommitCommand,
  buildConflictProbeCommand,
  buildFetchCommand,
  buildPushCommand,
  buildRebaseCommand,
  buildRebaseContinueCommand,
  acquireSyncLock,
  formatLockOwner,
  isUnmerged,
  recoverInterruptedOperation,
  createDebouncedGitSync,
  expandHomeDir,
  extractSlug,
  getTargetRepoRoot,
  gitCommitAndPush,
  inferCommitMessage,
  isGitSyncDisabled,
  parseGitStatusLine,
  runGitSync,
  shellQuote,
  toGitPath,
  validateGitSyncRepoOnStartup,
  type GitSyncDeps
} from './gitSync'
import type { GitSyncAlert } from './slackNotify'

const REPO = '/staging-clone'

/** The three directories that `getStagePaths` checks, in the order it joins them. */
const STAGE_DIRS = [
  path.join(REPO, 'src/content/'),
  path.join(REPO, 'src/data/'),
  path.join(REPO, 'public/uploads/img/original')
]

const STATUS_COMMAND = 'git status --porcelain'

interface FakeDeps extends GitSyncDeps {
  /** Every command given to `exec`, in order. */
  commands: string[]
  /** Every alert given to the notifier, in order. */
  alerts: GitSyncAlert[]
  /** Every delay `sleep` was asked for, in order. */
  sleeps: number[]
  /** The in-memory filesystem backing the sync lock. */
  files: Map<string, LockEntry>
  /** Mutable clock, advanced by `sleep`. */
  clock: { ms: number }
}

const LOCK_PATH = path.join(REPO, '.git/strapi-sync.lock')

/** One entry in the fake lock filesystem: contents plus the mtime staleness reads. */
interface LockEntry {
  contents: string
  mtimeMs: number
}

/** Seeds the fake filesystem with a lock held by someone else since `heldAtMs`. */
function heldLock(heldAtMs: number, contents = 'pid=999 host=other\n') {
  return new Map<string, LockEntry>([
    [LOCK_PATH, { contents, mtimeMs: heldAtMs }]
  ])
}

type FakeResponse =
  | string
  | GitCommandError
  | ((command: string) => string | GitCommandError)

/**
 * Builds test deps.
 *
 * `responses` keys a reply to a command prefix, and the longest matching
 * prefix wins — the sync issues several commands per run, so a test needs to
 * fail one step without failing the rest. `respond` still covers every command
 * for the cases that genuinely want that. `existing` gives the paths
 * `fileExists` reports as present.
 */
function createDeps(
  options: {
    respond?: (command: string) => string | GitCommandError
    responses?: Record<string, FakeResponse>
    existing?: string[]
    files?: Map<string, LockEntry>
    clock?: { ms: number }
  } = {}
): FakeDeps {
  const {
    respond,
    responses = {},
    existing = [REPO, ...STAGE_DIRS],
    files = new Map<string, LockEntry>(),
    clock = { ms: Date.UTC(2026, 0, 1) }
  } = options
  const commands: string[] = []
  const alerts: GitSyncAlert[] = []
  const sleeps: number[] = []

  const prefixes = Object.keys(responses).sort((a, b) => b.length - a.length)

  return {
    commands,
    alerts,
    sleeps,
    files,
    clock,
    exec: async (command) => {
      commands.push(command)
      const prefix = prefixes.find((p) => command.startsWith(p))
      if (prefix !== undefined) {
        const reply = responses[prefix]
        return typeof reply === 'function' ? reply(command) : reply
      }
      return respond ? respond(command) : ''
    },
    fileExists: (filepath) => existing.includes(filepath),
    notify: async (alert) => {
      alerts.push(alert)
    },
    sleep: async (ms) => {
      sleeps.push(ms)
      // Time only moves when something waits, so a lock timeout is reached
      // deterministically rather than by the test's own wall clock.
      clock.ms += ms
    },
    // An in-memory stand-in for the lock file, modelling the same primitives:
    // `claim` links a fully written temp file into place, and every entry
    // carries an mtime so staleness never depends on the contents.
    lockFs: {
      claim: (lockPath, tempPath, contents) => {
        files.set(tempPath, { contents, mtimeMs: clock.ms })
        files.delete(tempPath)
        if (files.has(lockPath)) return false
        files.set(lockPath, { contents, mtimeMs: clock.ms })
        return true
      },
      mtimeMs: (filepath) => files.get(filepath)?.mtimeMs ?? null,
      read: (filepath) => files.get(filepath)?.contents ?? null,
      rename: (from, to) => {
        const entry = files.get(from)
        if (entry === undefined) return false
        files.delete(from)
        files.set(to, entry)
        return true
      },
      remove: (filepath) => {
        files.delete(filepath)
      }
    },
    now: () => clock.ms
  }
}

/**
 * The first command issued that starts with `prefix`. The sync issues a fixed
 * sequence, but asserting on positional indices makes every test break when a
 * step is added in front.
 */
function commandStartingWith(deps: FakeDeps, prefix: string): string {
  const found = deps.commands.find((command) => command.startsWith(prefix))
  if (found === undefined) {
    throw new Error(
      `No command starting with "${prefix}". Issued:\n${deps.commands.join('\n')}`
    )
  }
  return found
}

/** The interrupted-operation probe every sync issues before anything else. */
const PROBE_COMMAND =
  'git rev-parse --git-path rebase-merge --git-path rebase-apply ' +
  '--git-path MERGE_HEAD --git-path CHERRY_PICK_HEAD'
const BRANCH_COMMAND = 'git rev-parse --abbrev-ref HEAD'

function gitFailure(
  command: string,
  streams: { stdout?: string; stderr?: string } = {}
): GitCommandError {
  const { stdout = '', stderr = '' } = streams
  return new GitCommandError(
    command,
    stdout,
    stderr,
    stderr.trim() || 'Command failed'
  )
}

/**
 * Builds porcelain lines for a set of `[status, path]` pairs. Git always
 * uses two columns for the status code. So this function pads `M` to the
 * staged `M ` form.
 */
function status(...lines: [string, string][]): string {
  return lines
    .map(([code, filepath]) => `${code.padEnd(2, ' ')} ${filepath}`)
    .join('\n')
}

/** Returns each value in turn, repeating the last one once exhausted. */
function sequenceOf(...values: (string | GitCommandError)[]) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

/**
 * A merge-tree probe result, in git's real shape: exit non-zero with
 * `<tree>\0<path>\0…\0\0<informational messages>` on stdout. The trailing
 * message section is part of the format and must not be read as paths.
 */
function probeConflictOutput(...paths: string[]): GitCommandError {
  const messages = paths.flatMap((p) => [
    '1',
    p,
    'CONFLICT (contents)',
    `CONFLICT (content): Merge conflict in ${p}\n`
  ])
  return gitFailure('git merge-tree', {
    stdout: ['tree-oid', ...paths, '', ...messages].join('\0') + '\0'
  })
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', REPO)
  vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'false')
  vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T0/B0/xxx')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

// ── Shell quoting ────────────────────────────────────────────────────────────

describe('shellQuote', () => {
  it('wraps a plain value in single quotes', () => {
    expect(shellQuote('page: update about')).toBe("'page: update about'")
  })

  it('escapes an apostrophe so an editor-authored title stays one argument', () => {
    expect(shellQuote("page: update Interledger's roadmap")).toBe(
      "'page: update Interledger'\\''s roadmap'"
    )
  })

  it('neutralises a quote-break injection attempt', () => {
    // A commit message can carry a slug from the editor into a shell command.
    // A bare `'` character in that slug would end the quoted string early.
    expect(shellQuote("x'; rm -rf /; echo '")).toBe(
      "'x'\\''; rm -rf /; echo '\\'''"
    )
  })

  it('leaves double quotes and backslashes alone', () => {
    expect(shellQuote('say "hi" c:\\path')).toBe('\'say "hi" c:\\path\'')
  })
})

// ── Repo resolution ──────────────────────────────────────────────────────────

describe('expandHomeDir', () => {
  it('expands a leading ~/', () => {
    expect(expandHomeDir('~/interledger.org-v5-staging')).toBe(
      path.join(os.homedir(), 'interledger.org-v5-staging')
    )
  })

  it('leaves an absolute path untouched', () => {
    expect(expandHomeDir('/srv/staging')).toBe('/srv/staging')
  })

  it('only expands ~ followed by a separator', () => {
    expect(expandHomeDir('~staging')).toBe('~staging')
  })
})

describe('getTargetRepoRoot', () => {
  it('resolves the configured path', () => {
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', '/srv/staging/../staging-clone')
    expect(getTargetRepoRoot()).toBe('/srv/staging-clone')
  })

  it('expands a ~/ configured path', () => {
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', '~/staging')
    expect(getTargetRepoRoot()).toBe(path.join(os.homedir(), 'staging'))
  })

  it('falls back to the project root when unset', () => {
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', '')
    expect(getTargetRepoRoot()).toBe(getProjectRoot())
  })
})

describe('isGitSyncDisabled', () => {
  it('is true only for the exact string "true"', () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    expect(isGitSyncDisabled()).toBe(true)
  })

  it('ignores other truthy-looking values', () => {
    for (const value of ['TRUE', '1', 'yes', '']) {
      vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', value)
      expect(isGitSyncDisabled()).toBe(false)
    }
  })
})

// ── Path normalisation ───────────────────────────────────────────────────────

describe('toGitPath', () => {
  it('makes an in-repo absolute path relative', () => {
    expect(toGitPath(REPO, `${REPO}/src/content/faqs/a.mdx`)).toBe(
      'src/content/faqs/a.mdx'
    )
  })

  it('passes a relative path through', () => {
    expect(toGitPath(REPO, 'src/data/nav.json')).toBe('src/data/nav.json')
  })

  it('rejects a path outside the repo', () => {
    expect(toGitPath(REPO, '/etc/passwd')).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping out-of-repo path')
    )
  })

  it('rejects a sibling directory that shares a prefix', () => {
    expect(
      toGitPath(REPO, '/staging-clone-backup/src/content/a.mdx')
    ).toBeNull()
  })

  it('returns null for the repo root itself', () => {
    expect(toGitPath(REPO, REPO)).toBeNull()
  })

  it('returns null for an empty path', () => {
    expect(toGitPath(REPO, '')).toBeNull()
  })

  it('normalises backslashes to forward slashes', () => {
    expect(toGitPath(REPO, 'src\\content\\faqs\\a.mdx')).toBe(
      'src/content/faqs/a.mdx'
    )
  })
})

// ── Porcelain parsing ────────────────────────────────────────────────────────

describe('parseGitStatusLine', () => {
  it('returns null for a blank line', () => {
    expect(parseGitStatusLine('')).toBeNull()
    expect(parseGitStatusLine('   ')).toBeNull()
  })

  it('parses an untracked file', () => {
    expect(parseGitStatusLine('?? src/content/faqs/new.mdx')).toEqual({
      status: '??',
      filepath: 'src/content/faqs/new.mdx'
    })
  })

  it('parses an unstaged modification, trimming the leading status space', () => {
    expect(parseGitStatusLine(' M src/content/faqs/a.mdx')).toEqual({
      status: 'M',
      filepath: 'src/content/faqs/a.mdx'
    })
  })

  it('parses a staged deletion', () => {
    expect(parseGitStatusLine('D  src/content/faqs/a.mdx')).toEqual({
      status: 'D',
      filepath: 'src/content/faqs/a.mdx'
    })
  })

  it('keeps the destination of a rename', () => {
    expect(
      parseGitStatusLine(
        'R  src/content/faqs/old.mdx -> src/content/faqs/new.mdx'
      )
    ).toEqual({
      status: 'R',
      filepath: 'src/content/faqs/new.mdx'
    })
  })

  it('preserves spaces inside a filename', () => {
    expect(
      parseGitStatusLine('?? public/uploads/img/original/hero image.avif')
    ).toEqual({
      status: '??',
      filepath: 'public/uploads/img/original/hero image.avif'
    })
  })
})

// ── Slug extraction ──────────────────────────────────────────────────────────

describe('extractSlug', () => {
  it('strips the directory and extension', () => {
    expect(extractSlug('src/content/foundation-pages/about.mdx')).toBe('about')
  })

  it('strips a leading blog date prefix', () => {
    expect(
      extractSlug(
        'src/content/foundation-blog-posts/2026-08-17-summit-recap.mdx'
      )
    ).toBe('summit-recap')
  })

  it('leaves a non-date numeric prefix alone', () => {
    expect(extractSlug('src/content/reports/2026-report.mdx')).toBe(
      '2026-report'
    )
  })

  it('handles a file with no extension', () => {
    expect(extractSlug('src/data/navigation')).toBe('navigation')
  })
})

// ── Commit message inference ─────────────────────────────────────────────────

describe('inferCommitMessage', () => {
  it('falls back to a bare sync when nothing under a content prefix changed', () => {
    const changes = [
      { status: '??', filepath: 'public/uploads/img/original/logo.png' }
    ]
    expect(inferCommitMessage('upload', changes)).toBe('upload: sync')
  })

  it('describes a single creation', () => {
    const changes = [{ status: '??', filepath: 'src/content/faqs/new.mdx' }]
    expect(inferCommitMessage('faq', changes)).toBe('faq: create new')
  })

  it('describes a single modification', () => {
    const changes = [{ status: 'M', filepath: 'src/content/faqs/a.mdx' }]
    expect(inferCommitMessage('faq', changes)).toBe('faq: update a')
  })

  it('describes a single deletion', () => {
    const changes = [{ status: 'D', filepath: 'src/content/faqs/a.mdx' }]
    expect(inferCommitMessage('faq', changes)).toBe('faq: delete a')
  })

  it('ignores non-content changes when a single content change is present', () => {
    const changes = [
      { status: 'M', filepath: 'src/content/faqs/a.mdx' },
      { status: '??', filepath: 'public/uploads/img/original/logo.png' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe('faq: update a')
  })

  it('reads a delete + add of different slugs as a rename', () => {
    const changes = [
      { status: 'D', filepath: 'src/content/faqs/old.mdx' },
      { status: '??', filepath: 'src/content/faqs/new.mdx' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe('faq: rename old -> new')
  })

  it('reads a delete + add of the same slug as an update', () => {
    // The same slug appears in two locale directories. This case is a
    // re-slug, not a rename.
    const changes = [
      { status: 'D', filepath: 'src/content/faqs/a.mdx' },
      { status: '??', filepath: 'src/content/faqs/es/a.mdx' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe('faq: update a')
  })

  it('summarises a bulk change', () => {
    const changes = [
      { status: 'D', filepath: 'src/content/faqs/a.mdx' },
      { status: '??', filepath: 'src/content/faqs/b.mdx' },
      { status: '??', filepath: 'src/content/faqs/c.mdx' },
      { status: 'M', filepath: 'src/content/faqs/d.mdx' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe(
      'faq: sync (1 deleted, 2 created, 1 modified)'
    )
  })

  it('omits empty buckets from the summary', () => {
    const changes = [
      { status: 'M', filepath: 'src/content/faqs/a.mdx' },
      { status: 'M', filepath: 'src/content/faqs/b.mdx' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe('faq: sync (2 modified)')
  })

  it('counts an added-then-modified file in both buckets', () => {
    // A git status of `AM` matches both isAdded and isModified. So the
    // counts can be higher than the number of files. This test records
    // the current behavior. It does not check that the behavior is correct.
    const changes = [
      { status: 'AM', filepath: 'src/content/faqs/a.mdx' },
      { status: 'M', filepath: 'src/content/faqs/b.mdx' }
    ]
    expect(inferCommitMessage('faq', changes)).toBe(
      'faq: sync (1 created, 2 modified)'
    )
  })
})

// ── Command construction ─────────────────────────────────────────────────────

describe('buildCommitCommand', () => {
  it('commits with the given message', () => {
    expect(buildCommitCommand('faq: update a')).toBe(
      "git commit -m 'faq: update a'"
    )
  })

  it('attributes the commit to the editor when an author is given', () => {
    expect(
      buildCommitCommand('faq: update a', {
        name: 'Ada Lovelace',
        email: 'ada@example.com'
      })
    ).toContain("--author='Ada Lovelace <ada@example.com>'")
  })

  it('quotes an author name containing an apostrophe', () => {
    expect(
      buildCommitCommand('faq: update a', {
        name: "O'Brien",
        email: 'o@example.com'
      })
    ).toContain("--author='O'\\''Brien <o@example.com>'")
  })
})

describe('buildAddCommand', () => {
  it('ends the options with -- so a path is never read as a flag', () => {
    expect(buildAddCommand(["'src/content/'", "'src/data/'"])).toBe(
      "git add -- 'src/content/' 'src/data/'"
    )
  })
})

describe('buildFetchCommand / buildPushCommand', () => {
  it('quotes the branch name', () => {
    expect(buildFetchCommand('staging')).toBe("git fetch origin 'staging'")
    expect(buildPushCommand('staging')).toBe("git push origin HEAD:'staging'")
  })
})

describe('buildRebaseCommand', () => {
  /**
   * A rebase swaps `ours` and `theirs`: `ours` is the upstream being replayed
   * onto (the developers' merged PR) and `theirs` is the commit being replayed
   * (the editor's save). `-X theirs` is therefore the "CMS wins" policy, and
   * flipping it to `-X ours` would silently invert it. This test exists to make
   * that flip fail loudly.
   */
  it('resolves conflicting hunks in favour of the CMS, not the upstream', () => {
    const command = buildRebaseCommand('origin/staging')
    expect(command).toContain('-X theirs')
    expect(command).not.toContain('-X ours')
    expect(command).toContain("rebase -X theirs 'origin/staging'")
  })

  it('autostashes in-flight writes and pins rerere off', () => {
    const command = buildRebaseCommand('origin/staging')
    expect(command).toContain('-c rebase.autoStash=true')
    expect(command).toContain('-c rerere.enabled=false')
  })
})

describe('buildRebaseContinueCommand', () => {
  it('pins the editor so --continue cannot block on a TTY that is not there', () => {
    expect(buildRebaseContinueCommand()).toContain('-c core.editor=true')
  })
})

describe('buildConflictProbeCommand', () => {
  it('probes with merge-tree so nothing in the working tree is touched', () => {
    expect(buildConflictProbeCommand('origin/staging')).toBe(
      "git merge-tree --write-tree --name-only -z 'origin/staging' HEAD"
    )
  })
})

// ── Startup validation ───────────────────────────────────────────────────────

describe('validateGitSyncRepoOnStartup', () => {
  it('does nothing when git sync is disabled', async () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = createDeps({ existing: [] })

    await expect(validateGitSyncRepoOnStartup(deps)).resolves.toBeUndefined()
    expect(deps.commands).toEqual([])
  })

  it('refuses to start when git sync is enabled without a Slack webhook', async () => {
    // In the past, git sync ran without Slack alerts. In that state, a
    // push failure could go unnoticed.
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    const deps = createDeps({ existing: [REPO, path.join(REPO, '.git')] })

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /SLACK_WEBHOOK_URL is not set while git sync is enabled/
    )
    expect(deps.commands).toEqual([])
  })

  it('names both escape hatches in the refusal', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    const deps = createDeps()

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /STRAPI_DISABLE_GIT_SYNC=true/
    )
  })

  it('treats a whitespace-only webhook as unset', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '   ')
    const deps = createDeps()

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /SLACK_WEBHOOK_URL is not set/
    )
  })

  it('allows a missing webhook when git sync is disabled', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = createDeps({ existing: [] })

    await expect(validateGitSyncRepoOnStartup(deps)).resolves.toBeUndefined()
  })

  it('checks the webhook before touching the filesystem', async () => {
    // A configuration error costs less time to diagnose. It is also more
    // likely on a fresh deployment.
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    const deps = createDeps({ existing: [] })

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /SLACK_WEBHOOK_URL/
    )
  })

  it('throws when the clone directory is missing', async () => {
    const deps = createDeps({ existing: [] })

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /repository path does not exist: \/staging-clone/
    )
  })

  it('throws when the directory is not a git checkout', async () => {
    const deps = createDeps({ existing: [REPO] })

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /not a git checkout/
    )
  })

  it('rethrows a failing rev-parse instead of booting into a broken repo', async () => {
    // The `exec` function returns errors. It does not reject its promise.
    // So this code must throw the error again, to make the bootstrap fail.
    const deps = createDeps({
      existing: [REPO, path.join(REPO, '.git')],
      respond: (command) =>
        gitFailure(command, { stderr: 'not a git repository' })
    })

    await expect(validateGitSyncRepoOnStartup(deps)).rejects.toThrow(
      /not a git repository/
    )
  })

  it('resolves after reading the branch', async () => {
    const deps = createDeps({
      existing: [REPO, path.join(REPO, '.git')],
      respond: () => 'staging'
    })

    await expect(validateGitSyncRepoOnStartup(deps)).resolves.toBeUndefined()
    expect(deps.commands).toEqual([BRANCH_COMMAND, PROBE_COMMAND])
  })

  it('clears a checkout an earlier run left mid-rebase', async () => {
    const deps = createDeps({
      existing: [
        REPO,
        path.join(REPO, '.git'),
        path.join(REPO, '.git/rebase-merge')
      ],
      responses: { [PROBE_COMMAND]: '.git/rebase-merge\n.git/rebase-apply' },
      respond: () => 'staging'
    })

    await expect(validateGitSyncRepoOnStartup(deps)).resolves.toBeUndefined()
    expect(deps.commands).toContain('git rebase --abort')
  })
})

// ── runGitSync ───────────────────────────────────────────────────────────────

describe('runGitSync', () => {
  it('skips entirely when git sync is disabled', async () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = createDeps()

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'skipped',
      reason: 'disabled'
    })
    expect(deps.commands).toEqual([])
  })

  it('reports a repo-root resolution failure instead of letting it escape unreported', async () => {
    // os.homedir() throws an error when it cannot find a home directory.
    // For example, this can happen in a container that runs as a user ID
    // with no entry in /etc/passwd. In the past, this error happened
    // before repoRoot had a value. So report() had no repo root to attach
    // to the alert.
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', '~/staging')
    vi.spyOn(os, 'homedir').mockImplementation(() => {
      throw new Error('Unable to determine home directory')
    })
    const deps = createDeps()

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toEqual([])
    expect(deps.alerts).toEqual([
      expect.objectContaining({
        outcome: 'failed',
        reason: 'Unable to determine home directory'
      })
    ])
  })

  it('reports a failed status read instead of reading it as a clean tree', async () => {
    // This test checks a past bug. The old code had a `catch { return [] }`
    // block. Because of this, a repo stuck in a rebase logged "No changes
    // to commit". The sync then looked like a success.
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: gitFailure(STATUS_COMMAND, {
          stderr:
            'fatal: not a git repository (or any of the parent directories)'
        })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(result).toMatchObject({
      error: expect.objectContaining({ name: 'GitCommandError' })
    })
    expect(deps.commands).toEqual([PROBE_COMMAND, STATUS_COMMAND])
  })

  it('preserves the git streams on the returned error', async () => {
    const deps = createDeps({
      respond: (command) =>
        gitFailure(command, { stdout: 'out', stderr: 'boom' })
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    if (result.outcome !== 'failed') return
    expect(result.error).toBeInstanceOf(GitCommandError)
    const error = result.error as GitCommandError
    expect(error.stdout).toBe('out')
    expect(error.stderr).toBe('boom')
    expect(error.combinedOutput).toBe('out\nboom')
  })

  it('skips when the tree is clean', async () => {
    const deps = createDeps({ respond: () => '' })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'skipped',
      reason: 'no-changes'
    })
    expect(deps.commands).toEqual([PROBE_COMMAND, STATUS_COMMAND])
  })

  it('skips when no content directory exists to stage', async () => {
    const deps = createDeps({
      existing: [REPO],
      respond: () => status(['M', 'src/content/faqs/a.mdx'])
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'skipped',
      reason: 'no-stage-paths'
    })
    expect(deps.commands).toEqual([PROBE_COMMAND, STATUS_COMMAND])
  })

  it('stages only the directories that exist', async () => {
    const deps = createDeps({
      existing: [REPO, path.join(REPO, 'src/content/')],
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : ''
    })

    await runGitSync('faq', undefined, deps)

    const add = commandStartingWith(deps, 'git add')
    expect(add).toContain("'src/content/'")
    expect(add).not.toContain("'src/data/'")
  })

  it('commits with the inferred message on success', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : ''
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'synced',
      message: 'faq: update a'
    })
    expect(commandStartingWith(deps, 'git commit')).toContain(
      "git commit -m 'faq: update a'"
    )
  })

  /**
   * The clean fast-forward is the case on all but a handful of days, and it
   * must stay cheap: fetching, rebasing or stashing on every save would touch
   * a working tree Strapi may be mid-write on for no reason.
   */
  it('pushes without fetching, rebasing or stashing when the push is accepted', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(['M', 'src/content/faqs/a.mdx']),
        [BRANCH_COMMAND]: 'staging'
      }
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.commands).toEqual([
      PROBE_COMMAND,
      STATUS_COMMAND,
      BRANCH_COMMAND,
      "git add -- 'src/content/' 'src/data/' 'public/uploads/img/original'",
      "git commit -m 'faq: update a'",
      "git push origin HEAD:'staging'"
    ])
    expect(deps.sleeps).toEqual([])
  })

  it('prefers an explicit slug and action over inference', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(
              ['M', 'src/content/faqs/a.mdx'],
              ['M', 'src/content/faqs/b.mdx']
            )
          : ''
    })

    expect(
      await runGitSync('page', { slug: 'about', action: 'delete' }, deps)
    ).toEqual({ outcome: 'synced', message: 'page: delete about' })
  })

  it('falls back to inference when the context has a slug but no action', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : ''
    })

    expect(await runGitSync('faq', { slug: 'about' }, deps)).toEqual({
      outcome: 'synced',
      message: 'faq: update a'
    })
  })

  it('passes the editor through as the commit author', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : ''
    })

    await runGitSync(
      'faq',
      { author: { name: 'Ada Lovelace', email: 'ada@example.com' } },
      deps
    )

    expect(commandStartingWith(deps, 'git commit')).toContain(
      "--author='Ada Lovelace <ada@example.com>'"
    )
  })

  it('escapes an apostrophe in an inferred message', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', "src/content/faqs/what's-ilp.mdx"])
          : ''
    })

    await runGitSync('faq', undefined, deps)

    expect(commandStartingWith(deps, 'git commit')).toContain(
      "git commit -m 'faq: update what'\\''s-ilp'"
    )
  })

  it('reports a failed push rather than swallowing it', async () => {
    // The old code logged the error and resolved normally. So a rejected
    // push looked the same as a successful sync.
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, {
              stderr: '! [rejected] staging -> staging (non-fast-forward)'
            })
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    if (result.outcome !== 'failed') return
    expect(result.error.message).toContain('non-fast-forward')
  })

  it('treats "nothing to commit" on stdout as a benign no-op', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(['M', 'src/content/faqs/a.mdx']),
        'git commit': gitFailure('git commit', {
          stdout: 'nothing to commit, working tree clean'
        })
      }
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'nothing-to-commit'
    })
  })

  it('treats "nothing to commit" on stderr as a benign no-op', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(['M', 'src/content/faqs/a.mdx']),
        'git commit': gitFailure('git commit', { stderr: 'nothing to commit' })
      }
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'nothing-to-commit'
    })
  })

  it('refuses to commit a tree that still has unresolved conflicts', async () => {
    // Every unmerged code also reads as modified or added, so without an
    // explicit check the sync would commit conflict markers into the MDX.
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(
          ['UU', 'src/content/faqs/a.mdx'],
          ['M', 'src/content/faqs/b.mdx']
        )
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).not.toContain(expect.stringContaining('git commit'))
    expect(deps.alerts[0]).toMatchObject({
      outcome: 'failed',
      reason: expect.stringContaining('src/content/faqs/a.mdx')
    })
  })
})

// ── Debounce ─────────────────────────────────────────────────────────────────

describe('createDebouncedGitSync', () => {
  const DELAY = 300

  function contentDeps(): FakeDeps {
    return createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : ''
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('does not run before the debounce window elapses', async () => {
    const deps = contentDeps()
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY - 1)

    expect(deps.commands).toEqual([])
    expect(await scheduler.settled()).toBeNull()
  })

  it('coalesces rapid saves into a single commit', async () => {
    const deps = contentDeps()
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq')
    scheduler.schedule('faq')
    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY)
    await scheduler.settled()

    expect(deps.commands).toEqual([
      PROBE_COMMAND,
      STATUS_COMMAND,
      BRANCH_COMMAND,
      expect.stringContaining('git add'),
      expect.stringContaining('git commit'),
      expect.stringContaining('git push')
    ])
  })

  it('lets the last caller win the label and context', async () => {
    // If two content types save inside one debounce window, the sync
    // makes one commit. The commit message comes from the type saved last.
    const deps = contentDeps()
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq', { slug: 'first', action: 'create' })
    scheduler.schedule('page', { slug: 'second', action: 'update' })
    await vi.advanceTimersByTimeAsync(DELAY)

    expect(await scheduler.settled()).toEqual({
      outcome: 'synced',
      message: 'page: update second'
    })
  })

  it('clears the context between windows', async () => {
    const deps = contentDeps()
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq', { slug: 'about', action: 'create' })
    await vi.advanceTimersByTimeAsync(DELAY)
    await scheduler.settled()

    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY)

    expect(await scheduler.settled()).toEqual({
      outcome: 'synced',
      message: 'faq: update a'
    })
  })

  it('surfaces a failed flush through settled()', async () => {
    const deps = createDeps({
      respond: (command) =>
        gitFailure(command, { stderr: 'rebase in progress' })
    })
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY)

    expect(await scheduler.settled()).toMatchObject({ outcome: 'failed' })
  })

  it('never rejects, even if a dependency throws', async () => {
    // Built from createDeps so it keeps every other dependency real; only the
    // one under test throws.
    const deps: FakeDeps = {
      ...createDeps(),
      exec: async () => {
        throw new Error('spawn ENOMEM')
      }
    }
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY)

    expect(await scheduler.settled()).toMatchObject({
      outcome: 'failed',
      error: expect.objectContaining({ message: 'spawn ENOMEM' })
    })
  })

  it('schedules nothing while git sync is disabled', async () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = contentDeps()
    const scheduler = createDebouncedGitSync(deps, DELAY)

    scheduler.schedule('faq')
    await vi.advanceTimersByTimeAsync(DELAY)

    expect(deps.commands).toEqual([])
    expect(await scheduler.settled()).toBeNull()
  })

  it('keeps separate instances independent', async () => {
    const first = contentDeps()
    const second = contentDeps()
    const schedulerA = createDebouncedGitSync(first, DELAY)
    const schedulerB = createDebouncedGitSync(second, DELAY)

    schedulerA.schedule('faq')
    schedulerB.schedule('page')
    await vi.advanceTimersByTimeAsync(DELAY)
    await Promise.all([schedulerA.settled(), schedulerB.settled()])

    expect(first.commands).toHaveLength(6)
    expect(second.commands).toHaveLength(6)
  })
})

// ── gitCommitAndPush ─────────────────────────────────────────────────────────

// ── Alerting ─────────────────────────────────────────────────────────────────

describe('git sync alerting', () => {
  const contentStatus = (command: string) =>
    command === STATUS_COMMAND ? status(['M', 'src/content/faqs/a.mdx']) : ''

  it('alerts on a failed push with the context needed to act', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(['M', 'src/content/faqs/a.mdx']),
        'git push': gitFailure('git push', {
          stderr: '! [rejected] non-fast-forward'
        })
      }
    })

    await runGitSync(
      'faq',
      { author: { name: 'Ada Lovelace', email: 'ada@example.com' } },
      deps
    )

    expect(deps.alerts).toEqual([
      {
        outcome: 'failed',
        label: 'faq',
        repoRoot: REPO,
        commitMessage: 'faq: update a',
        author: { name: 'Ada Lovelace', email: 'ada@example.com' },
        reason: '! [rejected] non-fast-forward',
        detail: '\n! [rejected] non-fast-forward'
      }
    ])
  })

  it('alerts when the status read itself fails', async () => {
    const deps = createDeps({
      respond: (command) =>
        gitFailure(command, { stderr: 'fatal: not a git repository' })
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toMatchObject([
      { outcome: 'failed', label: 'faq', reason: 'fatal: not a git repository' }
    ])
  })

  it('reports a successful sync as healthy so a recovery can fire', async () => {
    const deps = createDeps({ respond: contentStatus })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toMatchObject([{ outcome: 'healthy', label: 'faq' }])
  })

  it('reports an empty commit as healthy', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: status(['M', 'src/content/faqs/a.mdx']),
        'git commit': gitFailure('git commit', {
          stdout: 'nothing to commit, working tree clean'
        })
      }
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toMatchObject([{ outcome: 'healthy' }])
  })

  it('stays silent on a skip, which says nothing about repo health', async () => {
    // A clean working tree does not prove that the last push reached the
    // remote. So a clean tree must not clear an open failure.
    const deps = createDeps({ respond: () => '' })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toEqual([])
  })

  it('stays silent when git sync is disabled', async () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = createDeps({ respond: contentStatus })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toEqual([])
  })

  it('alerts when a dependency throws instead of returning an error', async () => {
    // In the past, the debounced wrapper converted an unexpected error to
    // a `failed` result on its own. This skipped the normal report path.
    // No alert was sent. Also, no recovery alert was sent on the next
    // success, because the notifier never saw the outage.
    const deps = createDeps()
    deps.exec = async () => {
      throw new Error('spawn ENOMEM')
    }

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({ outcome: 'failed' })
    expect(deps.alerts).toMatchObject([
      {
        outcome: 'failed',
        label: 'faq',
        repoRoot: REPO,
        reason: 'spawn ENOMEM'
      }
    ])
  })

  it('alerts when a dependency throws during a navigation commit', async () => {
    const deps = createDeps({ existing: [REPO] })
    deps.exec = async () => {
      throw new Error('spawn ENOMEM')
    }

    const result = await gitCommitAndPush(
      'src/data/nav.json',
      'nav: update',
      deps
    )

    expect(result).toMatchObject({ outcome: 'failed' })
    expect(deps.alerts).toMatchObject([
      { outcome: 'failed', label: 'navigation', reason: 'spawn ENOMEM' }
    ])
  })

  it('carries a stack as the detail when the error is not a git failure', async () => {
    const deps = createDeps()
    deps.exec = async () => {
      throw new Error('spawn ENOMEM')
    }

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts[0].detail).toContain('spawn ENOMEM')
  })

  it('does not reject when the notifier itself throws', async () => {
    // Reporting to Slack is a side channel. A broken notifier must not
    // turn a handled failure into a rejected sync.
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, { stderr: 'push rejected' })
    })
    deps.notify = async () => {
      throw new Error('slack exploded')
    }

    await expect(runGitSync('faq', undefined, deps)).resolves.toMatchObject({
      outcome: 'failed'
    })
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('slack exploded')
    )
  })

  it('reports an outage exactly once', async () => {
    // The outer safety net must not send a second report for a failure
    // that the inner function already reported.
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, { stderr: 'push rejected' })
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toHaveLength(1)
  })

  it('alerts on a failed navigation commit', async () => {
    const deps = createDeps({
      existing: [REPO],
      respond: (command) =>
        gitFailure(command, { stderr: 'Authentication failed' })
    })

    await gitCommitAndPush(
      `${REPO}/src/data/navigation.json`,
      'nav: update',
      deps
    )

    expect(deps.alerts).toMatchObject([
      {
        outcome: 'failed',
        label: 'navigation',
        commitMessage: 'nav: update',
        reason: 'Authentication failed'
      }
    ])
  })
})

describe('gitCommitAndPush', () => {
  const NAV = `${REPO}/src/data/navigation.json`

  it('skips when git sync is disabled', async () => {
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const deps = createDeps()

    expect(await gitCommitAndPush(NAV, 'nav: update', deps)).toEqual({
      outcome: 'skipped',
      reason: 'disabled'
    })
    expect(deps.commands).toEqual([])
  })

  it('reports a repo-root resolution failure instead of letting it escape unreported', async () => {
    vi.stubEnv('STRAPI_GIT_SYNC_REPO_PATH', '~/staging')
    vi.spyOn(os, 'homedir').mockImplementation(() => {
      throw new Error('Unable to determine home directory')
    })
    const deps = createDeps()

    const result = await gitCommitAndPush(NAV, 'nav: update', deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toEqual([])
    expect(deps.alerts).toEqual([
      expect.objectContaining({
        outcome: 'failed',
        reason: 'Unable to determine home directory'
      })
    ])
  })

  it('accepts a single path and stages it relative to the repo', async () => {
    const deps = createDeps({ existing: [REPO] })

    expect(await gitCommitAndPush(NAV, 'nav: update', deps)).toEqual({
      outcome: 'synced',
      message: 'nav: update'
    })
    expect(commandStartingWith(deps, 'git add')).toContain(
      "git add -- 'src/data/navigation.json'"
    )
  })

  it('accepts an array of paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush(
      [NAV, `${REPO}/src/data/footer.json`],
      'nav: update',
      deps
    )

    expect(commandStartingWith(deps, 'git add')).toContain(
      "git add -- 'src/data/navigation.json' 'src/data/footer.json'"
    )
  })

  it('deduplicates repeated paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush([NAV, NAV], 'nav: update', deps)

    expect(commandStartingWith(deps, 'git add')).toBe(
      "git add -- 'src/data/navigation.json'"
    )
  })

  it('also stages the uploads directory when it exists', async () => {
    const uploads = path.join(REPO, 'public', 'uploads', 'img', 'original')
    const deps = createDeps({ existing: [REPO, uploads] })

    await gitCommitAndPush(NAV, 'nav: update', deps)

    expect(commandStartingWith(deps, 'git add')).toContain(
      "'public/uploads/img/original'"
    )
  })

  it('drops out-of-repo paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush([NAV, '/etc/passwd'], 'nav: update', deps)

    expect(commandStartingWith(deps, 'git add')).not.toContain('passwd')
  })

  it('skips when every path was rejected', async () => {
    const deps = createDeps({ existing: [REPO] })

    expect(await gitCommitAndPush('/etc/passwd', 'nav: update', deps)).toEqual({
      outcome: 'skipped',
      reason: 'no-valid-paths'
    })
    expect(deps.commands).toEqual([PROBE_COMMAND])
  })

  it('reports a failure rather than resolving silently', async () => {
    const deps = createDeps({
      existing: [REPO],
      respond: (command) =>
        gitFailure(command, { stderr: 'Authentication failed' })
    })

    const result = await gitCommitAndPush(NAV, 'nav: update', deps)

    expect(result.outcome).toBe('failed')
    if (result.outcome !== 'failed') return
    expect(result.error.message).toContain('Authentication failed')
  })
})

// ── Conflict resolution ──────────────────────────────────────────────────────

describe('isUnmerged', () => {
  it('recognises every porcelain conflict code', () => {
    for (const code of ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']) {
      expect(isUnmerged(code)).toBe(true)
    }
  })

  it('leaves ordinary codes alone', () => {
    for (const code of ['M', 'A', 'D', 'R', '??', 'C']) {
      expect(isUnmerged(code)).toBe(false)
    }
  })
})

describe('recoverInterruptedOperation', () => {
  it('reports a clean checkout without issuing an abort', async () => {
    const deps = createDeps()

    expect(await recoverInterruptedOperation(REPO, deps)).toBe('clean')
    expect(deps.commands).toEqual([PROBE_COMMAND])
  })

  it('clears an interrupted rebase so later saves are not blocked by it', async () => {
    const deps = createDeps({
      existing: [REPO, path.join(REPO, '.git/rebase-merge')],
      responses: { [PROBE_COMMAND]: '.git/rebase-merge\n.git/rebase-apply' }
    })

    expect(await recoverInterruptedOperation(REPO, deps)).toBe('recovered')
    expect(deps.commands).toContain('git rebase --abort')
    expect(deps.commands).toContain('git merge --abort')
    expect(deps.commands).toContain('git cherry-pick --abort')
  })
})

describe('runGitSync conflict handling', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])
  const CONFLICT_PATH = 'src/content/faqs/a.mdx'
  const REBASE_PREFIX = 'git -c rebase.autoStash'
  const CONTINUE_PREFIX = 'git -c core.editor=true rebase --continue'

  function rejectedThenAccepted() {
    return sequenceOf(
      gitFailure('git push', { stderr: '! [rejected] non-fast-forward' }),
      ''
    )
  }

  it('rebases onto the upstream and retries the push when the push is rejected', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': rejectedThenAccepted(),
        'git merge-tree': probeConflictOutput(CONFLICT_PATH),
        'git log --oneline': '09b7eba fix(content): unwrap prose'
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      message: 'faq: update a'
    })
    expect(commandStartingWith(deps, 'git fetch')).toBe(
      "git fetch origin 'staging'"
    )
    expect(commandStartingWith(deps, REBASE_PREFIX)).toContain('-X theirs')
    expect(deps.sleeps).toEqual([750])
  })

  it('names the overwritten paths and superseded commits on the result', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': rejectedThenAccepted(),
        'git merge-tree': probeConflictOutput(
          CONFLICT_PATH,
          'src/content/faqs/b c.mdx'
        ),
        'git log --oneline': '09b7eba fix(content): unwrap prose'
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      conflict: {
        // A path containing a space proves the NUL parsing, not whitespace splitting.
        overwrittenPaths: [CONFLICT_PATH, 'src/content/faqs/b c.mdx'],
        supersededCommits: ['09b7eba fix(content): unwrap prose']
      }
    })
  })

  it('alerts that the CMS overwrote developer work, alongside the healthy alert', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': rejectedThenAccepted(),
        'git merge-tree': probeConflictOutput(CONFLICT_PATH),
        'git log --oneline': '09b7eba fix(content): unwrap prose'
      }
    })

    await runGitSync(
      'faq',
      { author: { name: 'Ada Lovelace', email: 'ada@example.com' } },
      deps
    )

    expect(deps.alerts).toMatchObject([
      { outcome: 'healthy' },
      {
        outcome: 'conflict-resolved',
        label: 'faq',
        author: { name: 'Ada Lovelace', email: 'ada@example.com' },
        overwrittenPaths: [CONFLICT_PATH],
        supersededCommits: ['09b7eba fix(content): unwrap prose']
      }
    ])
  })

  it('keeps the editor version when the upstream deleted a page the editor edited', async () => {
    const deps = createDeps({
      responses: {
        // Clean at the start, unmerged once the rebase stops, clean again after.
        [STATUS_COMMAND]: sequenceOf(
          CONTENT,
          status(['DU', CONFLICT_PATH]),
          ''
        ),
        [BRANCH_COMMAND]: 'staging',
        'git push': rejectedThenAccepted(),
        'git merge-tree': probeConflictOutput(CONFLICT_PATH),
        [REBASE_PREFIX]: gitFailure('git rebase', {
          stderr: 'CONFLICT (modify/delete)'
        })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      conflict: { resolvedPaths: [{ path: CONFLICT_PATH, action: 'kept-cms' }] }
    })
    expect(commandStartingWith(deps, 'git checkout --theirs')).toContain(
      CONFLICT_PATH
    )
    expect(commandStartingWith(deps, CONTINUE_PREFIX)).toBeTruthy()
  })

  it('deletes the page when the editor deleted it and the upstream modified it', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(
          CONTENT,
          status(['UD', CONFLICT_PATH]),
          ''
        ),
        [BRANCH_COMMAND]: 'staging',
        'git push': rejectedThenAccepted(),
        [REBASE_PREFIX]: gitFailure('git rebase', {
          stderr: 'CONFLICT (modify/delete)'
        })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      conflict: { resolvedPaths: [{ path: CONFLICT_PATH, action: 'deleted' }] }
    })
    expect(commandStartingWith(deps, 'git rm -f')).toContain(CONFLICT_PATH)
  })

  /**
   * The resolver deletes files, so it is confined to the directories the CMS
   * owns. An unmerged path a developer owns is never guessed at.
   */
  it('refuses to resolve an unmerged path outside the CMS-owned directories', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(
          CONTENT,
          status(['UU', 'src/utils/foo.ts'])
        ),
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' }),
        [REBASE_PREFIX]: gitFailure('git rebase', { stderr: 'CONFLICT' })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toContain('git rebase --abort')
    expect(deps.commands.some((c) => c.startsWith('git rm'))).toBe(false)
    expect(deps.alerts[0]).toMatchObject({
      outcome: 'failed',
      reason: expect.stringContaining('src/utils/foo.ts')
    })
  })

  it('never leaves the checkout mid-rebase when the rebase cannot be salvaged', async () => {
    const deps = createDeps({
      responses: {
        // Nothing unmerged, so the resolver has nothing to fix and gives up.
        [STATUS_COMMAND]: sequenceOf(CONTENT, ''),
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' }),
        [REBASE_PREFIX]: gitFailure('git rebase', {
          stderr: 'error: could not apply'
        })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toContain('git rebase --abort')
  })

  /**
   * A `-X theirs` rebase that exits zero leaves nothing unmerged, so anything
   * unmerged afterwards came from the autostash pop — conflict markers in the
   * working tree, which the next save would otherwise commit into the MDX.
   */
  it('treats autostash-pop residue as a failure rather than committing markers', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(CONTENT, status(['UU', CONFLICT_PATH])),
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    if (result.outcome !== 'failed') return
    expect(result.error.message).toMatch(/autostash|conflict markers/i)
  })

  it('retries a locked index instead of reporting it as a real failure', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': sequenceOf(
          gitFailure('git push', {
            stderr: "fatal: Unable to create '.git/index.lock': File exists."
          }),
          ''
        )
      }
    })

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
    // Lock contention is not a rejected push: retry, do not fetch or rebase.
    expect(deps.commands.some((c) => c.startsWith('git fetch'))).toBe(false)
  })

  it('gives up after a bounded number of push attempts', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' }),
        'git rev-list --count': '1'
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands.filter((c) => c.startsWith('git push'))).toHaveLength(
      3
    )
    expect(deps.sleeps).toEqual([750, 1500])
    expect(deps.alerts).toHaveLength(1)
  })
})

describe('unwinding a commit that could not be pushed', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])

  function deniedPush(aheadCount: string) {
    return createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' }),
        'git rev-list --count': aheadCount
      }
    })
  }

  it('unwinds its own commit so the checkout still fast-forwards', async () => {
    const deps = deniedPush('1')

    await runGitSync('faq', undefined, deps)

    expect(deps.commands).toContain('git reset --soft HEAD~1')
  })

  /**
   * More than one unpushed commit means another writer — the workflow's
   * Airtable step holds one for up to ~75s during its own retry loop — owns
   * one of them. Dropping HEAD~1 there would discard their work.
   */
  it('leaves the commit alone when another writer also has one unpushed', async () => {
    const deps = deniedPush('2')

    await runGitSync('faq', undefined, deps)

    expect(deps.commands).not.toContain('git reset --soft HEAD~1')
  })

  it('does nothing when the rebase already dropped the commit as empty', async () => {
    const deps = deniedPush('0')

    await runGitSync('faq', undefined, deps)

    expect(deps.commands).not.toContain('git reset --soft HEAD~1')
  })
})

describe('recovering a checkout an interrupted sync left behind', () => {
  const poisoned = {
    existing: [REPO, ...STAGE_DIRS, path.join(REPO, '.git/rebase-merge')],
    [PROBE_COMMAND]: '.git/rebase-merge'
  }

  it('clears the interrupted rebase before reading status, not after', async () => {
    const deps = createDeps({
      existing: poisoned.existing,
      responses: { [PROBE_COMMAND]: poisoned[PROBE_COMMAND] }
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.commands.indexOf('git rebase --abort')).toBeLessThan(
      deps.commands.indexOf(STATUS_COMMAND)
    )
  })

  /**
   * `rebase --abort` restores the pre-rebase HEAD, so the commits the
   * interrupted run never pushed are still local. A clean tree means nothing
   * to commit, but leaving them unpushed keeps the branch diverged — which is
   * the state the recovery exists to clear.
   */
  it('pushes the commits the interrupted run never got out', async () => {
    const deps = createDeps({
      existing: poisoned.existing,
      responses: {
        [PROBE_COMMAND]: poisoned[PROBE_COMMAND],
        [STATUS_COMMAND]: '',
        [BRANCH_COMMAND]: 'staging'
      }
    })

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
    expect(deps.commands).toContain("git push origin HEAD:'staging'")
  })

  it('still skips a clean tree when nothing was interrupted', async () => {
    const deps = createDeps({ responses: { [STATUS_COMMAND]: '' } })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'skipped',
      reason: 'no-changes'
    })
    expect(deps.commands.some((c) => c.startsWith('git push'))).toBe(false)
  })
})

// ── Review fixes (PR #702) ───────────────────────────────────────────────────

describe('the CMS-owned path boundary', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])
  const REBASE_PREFIX = 'git -c rebase.autoStash'

  /**
   * `public/uploads/img/original` has no trailing slash of its own, so a bare
   * `startsWith` would also match the sibling `…/original-backup/`. The residual
   * resolver runs `git rm -f`, so that would put developer files inside a
   * boundary whose entire purpose is to keep deletions away from them.
   */
  it('does not treat a sibling of the uploads directory as CMS-owned', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(
          CONTENT,
          status(['UD', 'public/uploads/img/original-backup/old.jpg'])
        ),
        [BRANCH_COMMAND]: 'staging',
        'git push': gitFailure('git push', { stderr: '! [rejected]' }),
        [REBASE_PREFIX]: gitFailure('git rebase', { stderr: 'CONFLICT' })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toContain('git rebase --abort')
    expect(deps.commands.some((c) => c.startsWith('git rm'))).toBe(false)
  })

  it('still treats the uploads directory itself as CMS-owned', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(
          CONTENT,
          status(['UD', 'public/uploads/img/original/hero.jpg']),
          ''
        ),
        [BRANCH_COMMAND]: 'staging',
        'git push': sequenceOf(
          gitFailure('git push', { stderr: '! [rejected]' }),
          ''
        ),
        [REBASE_PREFIX]: gitFailure('git rebase', { stderr: 'CONFLICT' })
      }
    })

    const result = await runGitSync('upload', undefined, deps)

    expect(result).toMatchObject({ outcome: 'synced' })
    expect(commandStartingWith(deps, 'git rm -f')).toContain(
      'public/uploads/img/original/hero.jpg'
    )
  })
})

describe('conflict reporting', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])
  const PATH = 'src/content/faqs/a.mdx'
  const REBASE_PREFIX = 'git -c rebase.autoStash'

  /**
   * The probe reports every conflicted path, existence conflicts included, so
   * without this the same file appears as both a hunk overwrite it never was
   * and a resolved existence conflict — and the Slack summary counts it twice.
   */
  it('reports an existence conflict once, not as an overwrite as well', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: sequenceOf(CONTENT, status(['DU', PATH]), ''),
        [BRANCH_COMMAND]: 'staging',
        'git push': sequenceOf(
          gitFailure('git push', { stderr: '! [rejected]' }),
          ''
        ),
        'git merge-tree': probeConflictOutput(PATH),
        [REBASE_PREFIX]: gitFailure('git rebase', { stderr: 'CONFLICT' })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      conflict: {
        overwrittenPaths: [],
        resolvedPaths: [{ path: PATH, action: 'kept-cms' }]
      }
    })
  })

  /**
   * `merge-tree --write-tree` needs git 2.38. Collapsing "probe failed" into
   * "no conflict" would let a silent `-X theirs` overwrite go unannounced,
   * which is the one thing this alert exists to prevent.
   */
  it('still announces an overwrite when the probe cannot run', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': sequenceOf(
          gitFailure('git push', { stderr: '! [rejected]' }),
          ''
        ),
        'git merge-tree': gitFailure('git merge-tree', {
          stderr: "error: unknown option `write-tree'"
        })
      }
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result).toMatchObject({
      outcome: 'synced',
      conflict: { detailsUnavailable: true, overwrittenPaths: [] }
    })
    expect(deps.alerts).toMatchObject([
      { outcome: 'healthy' },
      { outcome: 'conflict-resolved', detailsUnavailable: true }
    ])
  })

  it('stays silent when the probe runs and finds nothing', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git push': sequenceOf(
          gitFailure('git push', { stderr: '! [rejected]' }),
          ''
        )
      }
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts.map((a) => a.outcome)).toEqual(['healthy'])
  })
})

describe('lock contention', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])
  const lockError = (command: string) =>
    gitFailure(command, {
      stderr: "fatal: Unable to create '.git/index.lock': File exists."
    })

  it.each([
    ['git add', 'git add'],
    ['git commit', 'git commit']
  ])('retries %s rather than failing the sync', async (_label, prefix) => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        [prefix]: sequenceOf(lockError(prefix), '')
      }
    })

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
    expect(deps.commands.filter((c) => c.startsWith(prefix))).toHaveLength(2)
  })

  it('gives up on a lock that never clears', async () => {
    const deps = createDeps({
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        'git add': lockError('git add')
      }
    })

    expect((await runGitSync('faq', undefined, deps)).outcome).toBe('failed')
    expect(deps.commands.filter((c) => c.startsWith('git add'))).toHaveLength(4)
  })
})

describe('the sync mutex', () => {
  const CONTENT = status(['M', 'src/content/faqs/a.mdx'])
  const NOW = Date.UTC(2026, 0, 1)
  const STALE_MS = 10 * 60 * 1000

  function syncDeps(overrides: Parameters<typeof createDeps>[0] = {}) {
    return createDeps({
      ...overrides,
      responses: {
        [STATUS_COMMAND]: CONTENT,
        [BRANCH_COMMAND]: 'staging',
        ...(overrides.responses ?? {})
      }
    })
  }

  it('takes the lock for the duration and releases it afterwards', async () => {
    const deps = syncDeps()

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
    expect(deps.files.has(LOCK_PATH)).toBe(false)
  })

  it('releases the lock even when the sync fails', async () => {
    const deps = syncDeps({
      responses: { 'git push': gitFailure('git push', { stderr: 'boom' }) }
    })

    expect((await runGitSync('faq', undefined, deps)).outcome).toBe('failed')
    expect(deps.files.has(LOCK_PATH)).toBe(false)
  })

  it('leaves no temp file behind after claiming', async () => {
    const deps = syncDeps()

    await runGitSync('faq', undefined, deps)

    expect([...deps.files.keys()]).toEqual([])
  })

  /**
   * Failing closed loses nothing — the content is still in Strapi's database
   * and the next save retries — whereas proceeding would reintroduce exactly
   * the concurrent `rebase --abort` the lock exists to prevent.
   */
  it('refuses to run while another writer holds a fresh lock', async () => {
    const clock = { ms: NOW }
    const deps = syncDeps({ files: heldLock(NOW), clock })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(deps.commands).toEqual([])
    expect(deps.alerts[0]).toMatchObject({
      outcome: 'failed',
      reason: expect.stringContaining('sync lock')
    })
    // Still held: waiting must never remove someone else's live lock.
    expect(deps.files.has(LOCK_PATH)).toBe(true)
  })

  it('reclaims a lock whose holder died', async () => {
    const clock = { ms: NOW }
    const deps = syncDeps({ files: heldLock(NOW - STALE_MS - 1), clock })

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
  })

  /**
   * Staleness reads the mtime, never the contents, so a lock left truncated by
   * a process killed mid-write still ages out instead of wedging the repo
   * permanently.
   */
  it('reclaims a stale lock even when its contents are unreadable', async () => {
    const clock = { ms: NOW }
    const deps = syncDeps({ files: heldLock(NOW - STALE_MS - 1, ''), clock })

    expect(await runGitSync('faq', undefined, deps)).toMatchObject({
      outcome: 'synced'
    })
  })

  it('waits out a fresh lock it cannot read rather than stealing it', async () => {
    const clock = { ms: NOW }
    const deps = syncDeps({ files: heldLock(NOW, ''), clock })

    expect((await runGitSync('faq', undefined, deps)).outcome).toBe('failed')
    expect(deps.files.has(LOCK_PATH)).toBe(true)
  })

  /**
   * The acquire loop must check the deadline and sleep on every pass. An
   * earlier version skipped both whenever a reclaim looked possible, so a lock
   * that always looked reclaimable spun forever and hung the lifecycle hook.
   */
  it('always sleeps and eventually times out rather than spinning', async () => {
    const clock = { ms: NOW }
    const deps = syncDeps({ files: heldLock(NOW), clock })

    expect((await runGitSync('faq', undefined, deps)).outcome).toBe('failed')
    expect(deps.sleeps.length).toBeGreaterThan(0)
    expect(deps.sleeps.every((ms) => ms > 0)).toBe(true)
  })

  it('serialises the navigation commit path too', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush(`${REPO}/src/config/nav.json`, 'nav: update', deps)

    expect(deps.files.has(LOCK_PATH)).toBe(false)
  })
})

describe('sync lock primitives', () => {
  const NOW = Date.UTC(2026, 0, 1)
  const STALE_MS = 10 * 60 * 1000

  it('admits only one of two contenders racing to claim', async () => {
    const files = new Map<string, LockEntry>()
    const first = createDeps({ files })
    const second = createDeps({ files })

    const a = await acquireSyncLock(REPO, first)
    const b = await acquireSyncLock(REPO, second)

    expect(a).not.toBeInstanceOf(Error)
    expect(b).toBeInstanceOf(Error)
  })

  /**
   * Reclaiming by rename rather than delete is what makes this safe: the loser
   * of the rename finds the file gone and backs off, where a delete-then-create
   * let both remove it and both go on to hold it.
   */
  it('admits only one of two contenders racing to reclaim the same stale lock', async () => {
    const clock = { ms: NOW }
    const files = heldLock(NOW - STALE_MS - 1)
    const first = createDeps({ files, clock })
    const second = createDeps({ files, clock })

    const a = await acquireSyncLock(REPO, first)
    const b = await acquireSyncLock(REPO, second)

    expect(a).not.toBeInstanceOf(Error)
    expect(b).toBeInstanceOf(Error)
    expect([...files.keys()]).toEqual([LOCK_PATH])
  })

  /**
   * A holder that overran the staleness window can have its lock reclaimed and
   * replaced. Releasing unconditionally would delete the replacement's lock and
   * admit a third writer.
   */
  it('does not remove a lock that now belongs to someone else', async () => {
    const files = new Map<string, LockEntry>()
    const deps = createDeps({ files })

    const lock = await acquireSyncLock(REPO, deps)
    if (lock instanceof Error) throw lock

    // Someone reclaimed ours and took the lock in the meantime.
    files.set(LOCK_PATH, { contents: 'pid=999 host=other\n', mtimeMs: NOW })
    lock.release()

    expect(files.get(LOCK_PATH)?.contents).toBe('pid=999 host=other\n')
  })

  it('removes the lock when it is still ours', async () => {
    const files = new Map<string, LockEntry>()
    const deps = createDeps({ files })

    const lock = await acquireSyncLock(REPO, deps)
    if (lock instanceof Error) throw lock
    lock.release()

    expect(files.has(LOCK_PATH)).toBe(false)
  })

  it('identifies the holder for a human reading the lock', () => {
    const owner = formatLockOwner(NOW, 4242, 'strapi-vm', 'abc123')

    expect(owner).toContain('pid=4242')
    expect(owner).toContain('host=strapi-vm')
    expect(owner).toContain('nonce=abc123')
  })
})
