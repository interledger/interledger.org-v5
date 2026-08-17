import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSlackPayload,
  createSlackGitSyncNotifier,
  getSlackWebhookUrl,
  isSlackAlertingConfigured,
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

/** Serialises a payload so tests can assert on rendered text without walking blocks. */
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
    // A repo left mid-rebase fails on every save, one message per editor action.
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
    // The throttle must reset on recovery, or a fault recurring inside the
    // window is swallowed after being declared fixed.
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
