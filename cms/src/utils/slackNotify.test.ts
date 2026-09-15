import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSlackPayload,
  conflictFingerprint,
  createSlackGitSyncNotifier,
  getSlackWebhookUrl,
  isSlackAlertingConfigured,
  formatPathList,
  redactSecrets,
  truncateDetail,
  type FetchLike,
  type GitSyncAlert
} from './slackNotify'

const WEBHOOK = 'https://hooks.slack.com/services/T0/B0/xxx'
const FIFTEEN_MINUTES = 15 * 60 * 1_000

interface SlackPost {
  url: string
  payload: { text: string; blocks: unknown[] }
}

function createFetch(
  response: { ok?: boolean; status?: number; body?: string } = {}
) {
  const { ok = true, status = 200, body = 'ok' } = response
  const posts: SlackPost[] = []

  const fetchLike: FetchLike = async (url, init) => {
    posts.push({ url, payload: JSON.parse(init.body) })
    return { ok, status, text: async () => body }
  }

  return { fetchLike, posts }
}

/** Turns a payload into text. Tests can then check the text, instead of checking each block. */
function rendered(post: SlackPost): string {
  return JSON.stringify(post.payload)
}

const failure: GitSyncAlert = {
  outcome: 'failed',
  label: 'faq',
  repoRoot: '/staging-clone',
  commitMessage: 'faq: update a',
  reason: '! [rejected] non-fast-forward',
  detail: 'To github.com\n! [rejected] non-fast-forward'
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('NODE_ENV', 'production')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// ── Configuration ────────────────────────────────────────────────────────────

describe('getSlackWebhookUrl', () => {
  it('returns the configured url', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', WEBHOOK)
    expect(getSlackWebhookUrl()).toBe(WEBHOOK)
  })

  it('trims surrounding whitespace', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', `  ${WEBHOOK}  `)
    expect(getSlackWebhookUrl()).toBe(WEBHOOK)
  })

  it('returns null when unset', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    expect(getSlackWebhookUrl()).toBeNull()
    expect(isSlackAlertingConfigured()).toBe(false)
  })

  it('treats a whitespace-only value as unset', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '   ')
    expect(getSlackWebhookUrl()).toBeNull()
    expect(isSlackAlertingConfigured()).toBe(false)
  })
})

// ── Redaction ────────────────────────────────────────────────────────────────

describe('redactSecrets', () => {
  it('strips the credentials git echoes in a remote url', () => {
    expect(
      redactSecrets(
        'fatal: unable to access https://x-access-token:ghs_abcdefghij0123456789@github.com/interledger/x.git/'
      )
    ).toBe(
      'fatal: unable to access https://***:***@github.com/interledger/x.git/'
    )
  })

  it('strips a bare GitHub token', () => {
    expect(redactSecrets('token ghp_abcdefghij0123456789 rejected')).toBe(
      'token *** rejected'
    )
  })

  it('strips a fine-grained personal access token', () => {
    expect(
      redactSecrets('using github_pat_abcdefghij0123456789_extrachars here')
    ).toBe('using *** here')
  })

  it('strips every occurrence, not just the first', () => {
    const redacted = redactSecrets(
      'ghp_abcdefghij0123456789 then ghs_9876543210jihgfedcba'
    )
    expect(redacted).toBe('*** then ***')
  })

  it('leaves ordinary git output alone', () => {
    const message = '! [rejected] staging -> staging (non-fast-forward)'
    expect(redactSecrets(message)).toBe(message)
  })

  it('leaves a credential-free url alone', () => {
    const message = 'https://github.com/interledger/interledger.org-v5.git'
    expect(redactSecrets(message)).toBe(message)
  })
})

describe('truncateDetail', () => {
  it('leaves short text untouched', () => {
    expect(truncateDetail('short output')).toBe('short output')
  })

  it('keeps the tail, where the actionable line usually is', () => {
    const long = `${'x'.repeat(50)}FINAL LINE`
    expect(truncateDetail(long, 10)).toBe('…FINAL LINE')
  })

  it('trims surrounding whitespace', () => {
    expect(truncateDetail('\n  output  \n')).toBe('output')
  })
})

// ── Message ──────────────────────────────────────────────────────────────────

describe('buildSlackPayload', () => {
  it('names the host, environment, repo and content type on a failure', () => {
    const payload = buildSlackPayload({ ...failure, hostname: 'strapi-vm' })
    const text = JSON.stringify(payload)

    expect(payload.text).toBe('❌ Strapi git sync failed on strapi-vm')
    expect(text).toContain('strapi-vm')
    expect(text).toContain('production')
    expect(text).toContain('/staging-clone')
    expect(text).toContain('faq')
  })

  it('names the editor whose change is stranded', () => {
    const payload = buildSlackPayload({
      ...failure,
      hostname: 'strapi-vm',
      author: { name: 'Ada Lovelace', email: 'ada@example.com' }
    })

    expect(JSON.stringify(payload)).toContain('Ada Lovelace <ada@example.com>')
  })

  it('redacts the detail block before it leaves the process', () => {
    const payload = buildSlackPayload({
      ...failure,
      hostname: 'strapi-vm',
      detail:
        'remote: https://x-access-token:ghs_abcdefghij0123456789@github.com/x.git'
    })
    const text = JSON.stringify(payload)

    expect(text).not.toContain('ghs_abcdefghij0123456789')
    expect(text).toContain('***:***@github.com')
  })

  it('omits the detail block when there is nothing to show', () => {
    const payload = buildSlackPayload({
      ...failure,
      detail: undefined,
      hostname: 'strapi-vm'
    })

    expect(JSON.stringify(payload)).not.toContain('```')
  })

  it('reports how many repeats the throttle swallowed', () => {
    const payload = buildSlackPayload({
      ...failure,
      hostname: 'strapi-vm',
      suppressedCount: 23
    })

    expect(JSON.stringify(payload)).toContain('23 further failure(s)')
  })

  it('omits the suppression note when nothing was suppressed', () => {
    const payload = buildSlackPayload({
      ...failure,
      hostname: 'strapi-vm',
      suppressedCount: 0
    })

    expect(JSON.stringify(payload)).not.toContain('suppressed')
  })

  it('builds a recovery message', () => {
    const payload = buildSlackPayload({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone',
      hostname: 'strapi-vm'
    })

    expect(payload.text).toBe('✅ Strapi git sync recovered on strapi-vm')
  })
})

// ── Notifier ─────────────────────────────────────────────────────────────────

describe('createSlackGitSyncNotifier', () => {
  function setup(
    response?: { ok?: boolean; status?: number; body?: string },
    webhookUrl: string | null = WEBHOOK
  ) {
    const { fetchLike, posts } = createFetch(response)
    let clock = 0

    const notify = createSlackGitSyncNotifier({
      fetch: fetchLike,
      now: () => clock,
      webhookUrl: () => webhookUrl,
      hostname: () => 'strapi-vm'
    })

    return {
      notify,
      posts,
      advance: (ms: number) => {
        clock += ms
      }
    }
  }

  it('posts nothing when no webhook is configured', async () => {
    const { notify, posts } = setup(undefined, null)

    await notify(failure)

    expect(posts).toEqual([])
  })

  it('posts a failure to the webhook as JSON', async () => {
    const { notify, posts } = setup()

    await notify(failure)

    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe(WEBHOOK)
    expect(posts[0].payload.text).toContain('failed')
  })

  it('suppresses a repeat of the same root cause inside the window', async () => {
    // A repo stuck in a rebase fails on every save. Without a throttle,
    // this sends one message per editor action.
    const { notify, posts, advance } = setup()

    await notify(failure)
    advance(FIFTEEN_MINUTES - 1)
    await notify(failure)
    await notify(failure)

    expect(posts).toHaveLength(1)
  })

  it('deduplicates by root cause, not by content type', async () => {
    const { notify, posts } = setup()

    await notify(failure)
    await notify({ ...failure, label: 'page' })
    await notify({ ...failure, label: 'upload' })

    expect(posts).toHaveLength(1)
  })

  it('posts separately for a different root cause', async () => {
    const { notify, posts } = setup()

    await notify(failure)
    await notify({ ...failure, reason: 'Authentication failed' })

    expect(posts).toHaveLength(2)
  })

  it('posts again once the window elapses, counting what it swallowed', async () => {
    const { notify, posts, advance } = setup()

    await notify(failure)
    await notify(failure)
    await notify(failure)
    advance(FIFTEEN_MINUTES)
    await notify(failure)

    expect(posts).toHaveLength(2)
    expect(rendered(posts[1])).toContain('2 further failure(s)')
  })

  it('stays quiet on a healthy sync when nothing was broken', async () => {
    const { notify, posts } = setup()

    await notify({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    })

    expect(posts).toEqual([])
  })

  it('posts a recovery once the next sync succeeds', async () => {
    const { notify, posts } = setup()

    await notify(failure)
    await notify({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    })

    expect(posts).toHaveLength(2)
    expect(posts[1].payload.text).toContain('recovered')
  })

  it('posts only one recovery for a single outage', async () => {
    const { notify, posts } = setup()
    const healthy: GitSyncAlert = {
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    }

    await notify(failure)
    await notify(healthy)
    await notify(healthy)

    expect(posts).toHaveLength(2)
  })

  it('alerts immediately when the same fault returns after a recovery', async () => {
    // The throttle must reset when the sync recovers. Otherwise, a fault
    // that returns inside the window stays hidden after the code marks
    // it fixed.
    const { notify, posts } = setup()

    await notify(failure)
    await notify({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    })
    await notify(failure)

    expect(posts).toHaveLength(3)
    expect(posts[2].payload.text).toContain('failed')
  })

  it('swallows a transport error rather than breaking the lifecycle hook', async () => {
    const notify = createSlackGitSyncNotifier({
      fetch: async () => {
        throw new Error('ETIMEDOUT')
      },
      now: () => 0,
      webhookUrl: () => WEBHOOK,
      hostname: () => 'strapi-vm'
    })

    await expect(notify(failure)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('ETIMEDOUT')
    )
  })

  it('logs a rejected webhook post', async () => {
    const { notify } = setup({ ok: false, status: 404, body: 'no_service' })

    await expect(notify(failure)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('404'))
  })

  it('fingerprints on the redacted reason so a rotating token still dedupes', async () => {
    const { notify, posts } = setup()

    await notify({
      ...failure,
      reason: 'unable to access https://x:ghs_aaaaaaaaaaaaaaaaaaaa@github.com/x'
    })
    await notify({
      ...failure,
      reason: 'unable to access https://x:ghs_bbbbbbbbbbbbbbbbbbbb@github.com/x'
    })

    expect(posts).toHaveLength(1)
  })
})

// ── Conflict-resolved alerts ─────────────────────────────────────────────────

describe('conflict-resolved alerts', () => {
  const conflict: GitSyncAlert = {
    outcome: 'conflict-resolved',
    label: 'faq',
    repoRoot: '/staging-clone',
    commitMessage: 'faq: update a',
    author: { name: 'Ada Lovelace', email: 'ada@example.com' },
    overwrittenPaths: ['src/content/foundation-pages/events.mdx'],
    resolvedPaths: [
      { path: 'src/content/faqs/retired.mdx', action: 'deleted' }
    ],
    supersededCommits: ['09b7eba fix(content): unwrap prose']
  }

  function notifier(overrides: { now?: () => number } = {}) {
    const { fetchLike, posts } = createFetch()
    const notify = createSlackGitSyncNotifier({
      fetch: fetchLike,
      now: overrides.now ?? (() => 0),
      webhookUrl: () => WEBHOOK,
      hostname: () => 'strapi-vm'
    })
    return { notify, posts }
  }

  it('names the overwritten files, the resolutions and the superseded commits', () => {
    const text = JSON.stringify(
      buildSlackPayload({ ...conflict, hostname: 'strapi-vm' })
    )

    expect(text).toContain('src/content/foundation-pages/events.mdx')
    expect(text).toContain('src/content/faqs/retired.mdx')
    expect(text).toContain('09b7eba fix(content): unwrap prose')
    expect(text).toContain('git log -p 09b7eba')
  })

  it('reads distinctly from a failure and a recovery in the channel list', () => {
    const payload = buildSlackPayload({ ...conflict, hostname: 'strapi-vm' })

    expect(payload.text).toBe(
      '⚠️ Strapi git sync overwrote 2 file(s) on strapi-vm'
    )
    expect(payload.text).not.toContain('❌')
    expect(payload.text).not.toContain('✅')
  })

  /**
   * A conflict on an otherwise-healthy repo is the normal case. Reusing the
   * `healthy` outcome would drop it, because that branch only posts when a
   * failure is open.
   */
  it('posts even though the repo was never unhealthy', async () => {
    const { notify, posts } = notifier()

    await notify(conflict)

    expect(posts).toHaveLength(1)
  })

  it('does not mark the repo unhealthy, so the next success stays silent', async () => {
    const { notify, posts } = notifier()

    await notify(conflict)
    await notify({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    })

    expect(posts).toHaveLength(1)
  })

  it('throttles repeats over the same files', async () => {
    let clock = 0
    const { notify, posts } = notifier({ now: () => clock })

    await notify(conflict)
    clock += 60_000
    await notify(conflict)

    expect(posts).toHaveLength(1)

    clock += FIFTEEN_MINUTES
    await notify(conflict)
    expect(posts).toHaveLength(2)
  })

  it('keeps a fingerprint separate from a failure, so neither buries the other', async () => {
    const { notify, posts } = notifier()

    await notify(failure)
    await notify(conflict)

    expect(posts).toHaveLength(2)
  })

  it('fires again for a different set of files', async () => {
    const { notify, posts } = notifier()

    await notify(conflict)
    await notify({ ...conflict, overwrittenPaths: ['src/content/faqs/z.mdx'] })

    expect(posts).toHaveLength(2)
  })
})

// ── Review fixes (PR #702) ───────────────────────────────────────────────────

describe('conflict alert accounting', () => {
  const base: GitSyncAlert = {
    outcome: 'conflict-resolved',
    label: 'faq',
    repoRoot: '/staging-clone'
  }

  it('counts a path once even if it appears in both lists', () => {
    const payload = buildSlackPayload({
      ...base,
      hostname: 'strapi-vm',
      overwrittenPaths: ['src/content/faqs/a.mdx'],
      resolvedPaths: [{ path: 'src/content/faqs/a.mdx', action: 'kept-cms' }]
    })

    expect(payload.text).toContain('overwrote 1 file(s)')
  })

  it('says the details are unavailable rather than implying nothing was lost', () => {
    const payload = buildSlackPayload({
      ...base,
      hostname: 'strapi-vm',
      detailsUnavailable: true,
      overwrittenPaths: [],
      resolvedPaths: []
    })

    expect(payload.text).toContain('may have overwritten')
    expect(payload.text).not.toContain('0 file(s)')
    expect(JSON.stringify(payload.blocks)).toContain('2.38')
  })

  /**
   * The wording used to promise "the commit below", but nothing renders a sha
   * when the probe failed — so the operator was pointed at something that was
   * not there.
   */
  it('only points at references the message actually renders', () => {
    const rendered = JSON.stringify(
      buildSlackPayload({
        ...base,
        hostname: 'strapi-vm',
        detailsUnavailable: true,
        commitMessage: 'faq: update a',
        supersededCommits: []
      }).blocks
    )

    expect(rendered).toContain('faq: update a')
    expect(rendered).not.toContain('the commit below')
    expect(rendered).toMatch(/git log --oneline/)
  })
})

describe('formatPathList', () => {
  /**
   * A Slack section rejects text over 3000 characters, so a cap on entries
   * alone would drop the alert exactly when it carries the most detail.
   */
  it('stays inside a section limit even with long paths', () => {
    const paths = Array.from(
      { length: 20 },
      (_, i) =>
        `src/content/foundation-pages/${'very-long-slug-segment/'.repeat(12)}${i}.mdx`
    )

    const rendered = formatPathList(paths)

    expect(rendered.length).toBeLessThan(3000)
    expect(rendered).toContain('more')
  })

  it('lists everything when it comfortably fits', () => {
    const rendered = formatPathList(['a.mdx', 'b.mdx'])

    expect(rendered).toBe('```a.mdx\nb.mdx```')
  })
})

describe('conflict and failure throttles are independent', () => {
  const conflict: GitSyncAlert = {
    outcome: 'conflict-resolved',
    label: 'faq',
    repoRoot: '/staging-clone',
    overwrittenPaths: ['src/content/faqs/a.mdx']
  }

  /**
   * A recovery clears the failure throttle so the next outage alerts at once.
   * Sharing one map would let that recovery erase the conflict fingerprint and
   * re-announce an overwrite that was already reported.
   */
  it('a recovery does not re-post a conflict already announced', async () => {
    let clock = 0
    const { fetchLike, posts } = createFetch()
    const notify = createSlackGitSyncNotifier({
      fetch: fetchLike,
      now: () => clock,
      webhookUrl: () => WEBHOOK,
      hostname: () => 'strapi-vm'
    })

    await notify(conflict)
    expect(posts).toHaveLength(1)

    clock += 60_000
    await notify(failure)
    clock += 60_000
    await notify({
      outcome: 'healthy',
      label: 'faq',
      repoRoot: '/staging-clone'
    })

    // The same conflict, still inside the 15-minute suppression window.
    clock += 60_000
    await notify(conflict)

    expect(posts.map((p) => p.payload.text)).toEqual([
      expect.stringContaining('overwrote'),
      expect.stringContaining('failed'),
      expect.stringContaining('recovered')
    ])
  })

  it('a conflict does not clear an open failure', async () => {
    let clock = 0
    const { fetchLike, posts } = createFetch()
    const notify = createSlackGitSyncNotifier({
      fetch: fetchLike,
      now: () => clock,
      webhookUrl: () => WEBHOOK,
      hostname: () => 'strapi-vm'
    })

    await notify(failure)
    await notify(conflict)
    // Same failure, still throttled: the conflict must not have reset it.
    clock += 60_000
    await notify(failure)

    expect(posts).toHaveLength(2)
  })
})

describe('conflictFingerprint', () => {
  const base: GitSyncAlert = {
    outcome: 'conflict-resolved',
    label: 'faq',
    repoRoot: '/staging-clone'
  }

  it('groups repeats over the same files regardless of order', () => {
    const a = conflictFingerprint({ ...base, overwrittenPaths: ['a', 'b'] })
    const b = conflictFingerprint({ ...base, overwrittenPaths: ['b', 'a'] })

    expect(a).toBe(b)
  })

  it('counts a hunk overwrite and an existence conflict on one path as one', () => {
    const a = conflictFingerprint({ ...base, overwrittenPaths: ['a'] })
    const b = conflictFingerprint({
      ...base,
      resolvedPaths: [{ path: 'a', action: 'kept-cms' }]
    })

    expect(a).toBe(b)
  })

  /**
   * With no paths to key on, a shared fingerprint would let unrelated saves
   * suppress one another for the whole 15-minute window, and the first save's
   * commit and editor would be shown for every later overwrite.
   */
  it('keeps unlisted conflicts apart by commit', () => {
    const a = conflictFingerprint({
      ...base,
      detailsUnavailable: true,
      commitMessage: 'faq: update a'
    })
    const b = conflictFingerprint({
      ...base,
      detailsUnavailable: true,
      commitMessage: 'faq: update b'
    })

    expect(a).not.toBe(b)
  })

  it('still groups repeats of the same unlisted conflict', () => {
    const alert = {
      ...base,
      detailsUnavailable: true,
      commitMessage: 'faq: update a'
    }

    expect(conflictFingerprint(alert)).toBe(conflictFingerprint({ ...alert }))
  })
})
