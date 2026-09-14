import os from 'os'
import { tryCatchAsync } from './tryCatch'

/** This value stops a slow Slack webhook from blocking a content lifecycle hook. */
const WEBHOOK_TIMEOUT_MS = 5_000
/**
 * A clone stuck in a rebase fails on every later save. Without a throttle,
 * this would send one alert per editor action. This value limits the
 * alerts to one per root cause, then a summary message.
 */
const REPEAT_SUPPRESSION_MS = 15 * 60 * 1_000
/** This value keeps the end of the text. The useful line is usually near the end. */
const MAX_DETAIL_CHARS = 1_000

export interface GitSyncAlert {
  /** The `healthy` value covers a completed sync and a true no-op. It does not cover a skip. */
  outcome: 'failed' | 'healthy'
  label: string
  repoRoot: string
  /** The commit message the sync tried to use. */
  commitMessage?: string
  /** A one-line failure summary. The code uses this text as the throttle fingerprint. */
  reason?: string
  /** The raw git output. The code redacts and truncates this text before it leaves the process. */
  detail?: string
  /** The editor whose change did not reach the repository because of the failure. */
  author?: { name: string; email: string }
}

export type NotifyGitSync = (alert: GitSyncAlert) => Promise<void>

interface SlackResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

export type FetchLike = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  }
) => Promise<SlackResponse>

export interface SlackNotifierDeps {
  fetch: FetchLike
  now: () => number
  webhookUrl: () => string | null
  hostname: () => string
}

// ── Configuration ────────────────────────────────────────────────────────────

export function getSlackWebhookUrl(): string | null {
  const url = process.env.SLACK_WEBHOOK_URL?.trim()
  return url ? url : null
}

export function isSlackAlertingConfigured(): boolean {
  return getSlackWebhookUrl() !== null
}

// ── Redaction ────────────────────────────────────────────────────────────────

/** Git repeats the remote URL when authentication fails. Our remote URL contains a GitHub App token. */
const SECRET_PATTERNS: [RegExp, string][] = [
  // https://x-access-token:<token>@github.com/...
  [/(\bhttps?:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1***:***@'],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, '***'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '***']
]

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, [pattern, replacement]) =>
      redacted.replace(pattern, replacement),
    text
  )
}

export function truncateDetail(
  text: string,
  maxChars: number = MAX_DETAIL_CHARS
): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `…${trimmed.slice(-maxChars)}`
}

// ── Message ──────────────────────────────────────────────────────────────────

interface SlackPayload {
  text: string
  blocks: unknown[]
}

export interface SlackMessageInput extends GitSyncAlert {
  hostname: string
  /** The number of repeat alerts the throttle blocked since the last post. */
  suppressedCount?: number
}

function field(label: string, value: string) {
  return { type: 'mrkdwn', text: `*${label}:*\n${value}` }
}

export function buildSlackPayload(input: SlackMessageInput): SlackPayload {
  const environment = process.env.NODE_ENV ?? 'unknown'

  if (input.outcome === 'healthy') {
    const text = `✅ Strapi git sync recovered on ${input.hostname}`
    return {
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `✅ *Strapi git sync recovered*` }
        },
        {
          type: 'section',
          fields: [
            field('Host', input.hostname),
            field('Environment', environment),
            field('Repo', input.repoRoot),
            field('Content type', input.label)
          ]
        }
      ]
    }
  }

  const text = `❌ Strapi git sync failed on ${input.hostname}`
  const fields = [
    field('Host', input.hostname),
    field('Environment', environment),
    field('Repo', input.repoRoot),
    field('Content type', input.label)
  ]
  if (input.commitMessage) fields.push(field('Commit', input.commitMessage))
  if (input.author) {
    fields.push(field('Editor', `${input.author.name} <${input.author.email}>`))
  }

  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❌ *Strapi git sync failed*\nContent changes are not reaching the staging branch.`
      }
    },
    { type: 'section', fields }
  ]

  if (input.detail) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${truncateDetail(redactSecrets(input.detail))}\`\`\``
      }
    })
  }

  if (input.suppressedCount) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${input.suppressedCount} further failure(s) with the same cause were suppressed since the last alert.`
        }
      ]
    })
  }

  return { text, blocks }
}

// ── Notifier ─────────────────────────────────────────────────────────────────

const defaultNotifierDeps: SlackNotifierDeps = {
  fetch: (url, init) => fetch(url, init),
  now: () => Date.now(),
  webhookUrl: getSlackWebhookUrl,
  hostname: () => os.hostname()
}

interface ThrottleEntry {
  lastSentAt: number
  suppressedCount: number
}

/**
 * Builds a notifier with its own throttle and health state. The notifier
 * groups alerts by root cause, not by content type. One broken repository
 * makes every content type fail at the same time.
 */
export function createSlackGitSyncNotifier(
  overrides: Partial<SlackNotifierDeps> = {}
): NotifyGitSync {
  const deps = { ...defaultNotifierDeps, ...overrides }
  const throttle = new Map<string, ThrottleEntry>()
  let unhealthy = false

  async function post(url: string, payload: SlackPayload): Promise<void> {
    const response = await tryCatchAsync(() =>
      deps.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
      })
    )

    if (response instanceof Error) {
      console.error(`⚠️  Slack notification failed: ${response.message}`)
      return
    }

    if (!response.ok) {
      const body = await tryCatchAsync(() => response.text())
      const detail = body instanceof Error ? '' : `: ${body}`
      console.error(`⚠️  Slack webhook returned ${response.status}${detail}`)
    }
  }

  return async function notifyGitSync(alert: GitSyncAlert): Promise<void> {
    const url = deps.webhookUrl()
    // This case is normal in local development and in CI. The startup
    // guard checks real deployments.
    if (!url) return

    const hostname = deps.hostname()

    if (alert.outcome === 'healthy') {
      if (!unhealthy) return
      unhealthy = false
      throttle.clear()
      await post(url, buildSlackPayload({ ...alert, hostname }))
      return
    }

    unhealthy = true

    const fingerprint = redactSecrets(alert.reason ?? 'unknown failure')
    const entry = throttle.get(fingerprint)
    const now = deps.now()

    if (entry && now - entry.lastSentAt < REPEAT_SUPPRESSION_MS) {
      entry.suppressedCount += 1
      return
    }

    throttle.set(fingerprint, { lastSentAt: now, suppressedCount: 0 })
    await post(
      url,
      buildSlackPayload({
        ...alert,
        hostname,
        suppressedCount: entry?.suppressedCount ?? 0
      })
    )
  }
}

/** The notifier that git sync uses for the whole process. */
export const notifyGitSyncToSlack: NotifyGitSync = createSlackGitSyncNotifier()
