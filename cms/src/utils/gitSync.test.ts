import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectRoot } from './paths'
import {
  GitCommandError,
  buildCommitCommand,
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

/** The three directories `getStagePaths` probes, as it joins them. */
const STAGE_DIRS = [
  path.join(REPO, 'src/content/'),
  path.join(REPO, 'src/data/'),
  path.join(REPO, 'public/uploads/img/original')
]

const STATUS_COMMAND = 'git status --porcelain'

interface FakeDeps extends GitSyncDeps {
  /** Every command passed to `exec`, in order. */
  commands: string[]
  /** Every alert handed to the notifier, in order. */
  alerts: GitSyncAlert[]
}

/**
 * Builds deps whose `exec` answers from `respond`, defaulting to success with
 * empty stdout. `existing` lists the paths `fileExists` reports as present.
 */
function createDeps(
  options: {
    respond?: (command: string) => string | GitCommandError
    existing?: string[]
  } = {}
): FakeDeps {
  const { respond = () => '', existing = [REPO, ...STAGE_DIRS] } = options
  const commands: string[] = []
  const alerts: GitSyncAlert[] = []

  return {
    commands,
    alerts,
    exec: async (command) => {
      commands.push(command)
      return respond(command)
    },
    fileExists: (filepath) => existing.includes(filepath),
    notify: async (alert) => {
      alerts.push(alert)
    }
  }
}

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
 * Porcelain lines for a set of `[status, path]` pairs. Codes are padded to the
 * two columns git always emits, so `M` becomes the staged `M ` form.
 */
function status(...lines: [string, string][]): string {
  return lines
    .map(([code, filepath]) => `${code.padEnd(2, ' ')} ${filepath}`)
    .join('\n')
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
    // Commit messages carry editor-controlled slugs, and the whole command is
    // handed to a shell — a bare `'` would end the quoted string.
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
    // Same slug in two locale directories — a re-slug, not a rename.
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
    // `AM` satisfies both isAdded and isModified, so the summary counts add up
    // to more than the number of files. Documented, not endorsed.
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
  it('chains add, commit, rebase and push', () => {
    expect(buildCommitCommand(["'src/content/'"], 'faq: update a')).toBe(
      "git add 'src/content/' && git commit -m 'faq: update a' && git pull --rebase && git push"
    )
  })

  it('attributes the commit to the editor when an author is given', () => {
    expect(
      buildCommitCommand(["'src/content/'"], 'faq: update a', {
        name: 'Ada Lovelace',
        email: 'ada@example.com'
      })
    ).toContain("--author='Ada Lovelace <ada@example.com>'")
  })

  it('quotes an author name containing an apostrophe', () => {
    expect(
      buildCommitCommand(["'src/content/'"], 'faq: update a', {
        name: "O'Brien",
        email: 'o@example.com'
      })
    ).toContain("--author='O'\\''Brien <o@example.com>'")
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
    // Syncing without alerting is the state that let push failures go unnoticed.
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
    // A config error is cheaper to diagnose than a filesystem one, and it is
    // the likelier mistake on a fresh deploy.
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
    // Regression guard: exec now returns errors rather than rejecting, so this
    // needs an explicit rethrow to keep failing the bootstrap.
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
    expect(deps.commands).toEqual(['git rev-parse --abbrev-ref HEAD'])
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

  it('reports a failed status read instead of reading it as a clean tree', async () => {
    // Regression guard for the original `catch { return [] }`: a repo left
    // mid-rebase used to log "No changes to commit" and look like success.
    const deps = createDeps({
      respond: (command) =>
        gitFailure(command, {
          stderr:
            'fatal: not a git repository (or any of the parent directories)'
        })
    })

    const result = await runGitSync('faq', undefined, deps)

    expect(result.outcome).toBe('failed')
    expect(result).toMatchObject({
      error: expect.objectContaining({ name: 'GitCommandError' })
    })
    expect(deps.commands).toEqual([STATUS_COMMAND])
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
    expect(deps.commands).toEqual([STATUS_COMMAND])
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
    expect(deps.commands).toEqual([STATUS_COMMAND])
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

    expect(deps.commands[1]).toContain("git add 'src/content/' &&")
    expect(deps.commands[1]).not.toContain("'src/data/'")
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
    expect(deps.commands[1]).toContain("git commit -m 'faq: update a'")
    expect(deps.commands[1]).toContain('git pull --rebase && git push')
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

    expect(deps.commands[1]).toContain(
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

    expect(deps.commands[1]).toContain(
      "git commit -m 'faq: update what'\\''s-ilp'"
    )
  })

  it('reports a failed push rather than swallowing it', async () => {
    // The original implementation logged and resolved, so a rejected push was
    // indistinguishable from a successful sync to every caller.
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
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, {
              stdout: 'nothing to commit, working tree clean'
            })
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'nothing-to-commit'
    })
  })

  it('treats "nothing to commit" on stderr as a benign no-op', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, { stderr: 'nothing to commit' })
    })

    expect(await runGitSync('faq', undefined, deps)).toEqual({
      outcome: 'nothing-to-commit'
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

    expect(deps.commands).toEqual([STATUS_COMMAND, expect.any(String)])
  })

  it('lets the last caller win the label and context', async () => {
    // Two content types saved inside one window produce one commit, described
    // by whichever saved last — worth knowing when reading the log.
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
    const deps: FakeDeps = {
      commands: [],
      alerts: [],
      exec: async () => {
        throw new Error('spawn ENOMEM')
      },
      fileExists: () => true,
      notify: async () => {}
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

    expect(first.commands).toHaveLength(2)
    expect(second.commands).toHaveLength(2)
  })
})

// ── gitCommitAndPush ─────────────────────────────────────────────────────────

// ── Alerting ─────────────────────────────────────────────────────────────────

describe('git sync alerting', () => {
  const contentStatus = (command: string) =>
    command === STATUS_COMMAND ? status(['M', 'src/content/faqs/a.mdx']) : ''

  it('alerts on a failed push with the context needed to act', async () => {
    const deps = createDeps({
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, { stderr: '! [rejected] non-fast-forward' })
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
      respond: (command) =>
        command === STATUS_COMMAND
          ? status(['M', 'src/content/faqs/a.mdx'])
          : gitFailure(command, {
              stdout: 'nothing to commit, working tree clean'
            })
    })

    await runGitSync('faq', undefined, deps)

    expect(deps.alerts).toMatchObject([{ outcome: 'healthy' }])
  })

  it('stays silent on a skip, which says nothing about repo health', async () => {
    // A clean tree does not prove the last push landed, so it must not be
    // allowed to clear an outstanding failure.
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

  it('accepts a single path and stages it relative to the repo', async () => {
    const deps = createDeps({ existing: [REPO] })

    expect(await gitCommitAndPush(NAV, 'nav: update', deps)).toEqual({
      outcome: 'synced',
      message: 'nav: update'
    })
    expect(deps.commands[0]).toContain("git add 'src/data/navigation.json'")
  })

  it('accepts an array of paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush(
      [NAV, `${REPO}/src/data/footer.json`],
      'nav: update',
      deps
    )

    expect(deps.commands[0]).toContain(
      "git add 'src/data/navigation.json' 'src/data/footer.json'"
    )
  })

  it('deduplicates repeated paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush([NAV, NAV], 'nav: update', deps)

    expect(deps.commands[0]).toContain("git add 'src/data/navigation.json' &&")
  })

  it('also stages the uploads directory when it exists', async () => {
    const uploads = path.join(REPO, 'public', 'uploads', 'img', 'original')
    const deps = createDeps({ existing: [REPO, uploads] })

    await gitCommitAndPush(NAV, 'nav: update', deps)

    expect(deps.commands[0]).toContain("'public/uploads/img/original'")
  })

  it('drops out-of-repo paths', async () => {
    const deps = createDeps({ existing: [REPO] })

    await gitCommitAndPush([NAV, '/etc/passwd'], 'nav: update', deps)

    expect(deps.commands[0]).not.toContain('passwd')
  })

  it('skips when every path was rejected', async () => {
    const deps = createDeps({ existing: [REPO] })

    expect(await gitCommitAndPush('/etc/passwd', 'nav: update', deps)).toEqual({
      outcome: 'skipped',
      reason: 'no-valid-paths'
    })
    expect(deps.commands).toEqual([])
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
