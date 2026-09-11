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
/** A Slack section block rejects text over 3000 characters. A long path list has to stop somewhere. */
const MAX_LISTED_PATHS = 20

/** How the residual resolver settled a conflict that `-X theirs` could not take on its own. */
export interface ResolvedPath {
  path: string
  /** `kept-cms` restored the editor's file over an upstream delete. `deleted` removed it. */
  action: 'kept-cms' | 'deleted'
}

export interface GitSyncAlert {
  /**
   * The `healthy` value covers a completed sync and a true no-op. It does not
   * cover a skip.
   *
   * `conflict-resolved` is an audit record, not a health signal: the sync
   * succeeded, but integrating it overwrote commits already on the branch.
   * It is a separate outcome rather than a flag on `healthy` because the
   * notifier's `healthy` branch only fires when the repo was previously
   * unhealthy, and because it must not mark the repo unhealthy or be cleared
   * by the next ordinary success.
   */
  outcome: 'failed' | 'healthy' | 'conflict-resolved'
  label: string
  repoRoot: string
  /** The commit message the sync tried to use. */
  commitMessage?: string
  /** A one-line failure summary. The code uses this text as the throttle fingerprint. */
  reason?: string
  /** The raw git output. The code redacts and truncates this text before it leaves the process. */
  detail?: string
  /**
   * For a failure, the editor whose change did not reach the repository. For a
   * resolved conflict, the editor whose save won.
   */
  author?: { name: string; email: string }
  /** Paths where a conflicting hunk was taken from the CMS side. */
  overwrittenPaths?: string[]
  /** Existence conflicts the residual resolver settled, with the action taken. */
  resolvedPaths?: ResolvedPath[]
  /** Upstream commits whose changes were superseded, as `<sha> <subject>`. */
  supersededCommits?: string[]
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

/** Renders a path list as a code block, capped so the block stays inside Slack's 3000-char limit. */
export function formatPathList(paths: string[]): string {
  const shown = paths.slice(0, MAX_LISTED_PATHS)
  const overflow = paths.length - shown.length
  const lines = overflow > 0 ? [...shown, `…and ${overflow} more`] : [...shown]
  return `\`\`\`${lines.join('\n')}\`\`\``
}

/** The identifying context fields every alert carries. */
function contextFields(input: SlackMessageInput, environment: string) {
  return [
    field('Host', input.hostname),
    field('Environment', environment),
    field('Repo', input.repoRoot),
    field('Content type', input.label)
  ]
}

/**
 * The sync succeeded, but it had to overwrite commits already on the branch to
 * do it. Nobody is watching the branch for this — nothing lints a direct push
 * to the deploy branch — so this message is the only thing standing between a
 * silently reverted PR and a surprised developer.
 */
function buildConflictPayload(input: SlackMessageInput): SlackPayload {
  const environment = process.env.NODE_ENV ?? 'unknown'
  const overwritten = input.overwrittenPaths ?? []
  const resolved = input.resolvedPaths ?? []
  const superseded = input.supersededCommits ?? []

  // A distinct emoji and verb from both other states (❌ failed, ✅ recovered)
  // so the channel reads at a glance.
  const text = `⚠️ Strapi git sync overwrote ${overwritten.length + resolved.length} file(s) on ${input.hostname}`

  const fields = contextFields(input, environment)
  if (input.commitMessage) fields.push(field('Commit', input.commitMessage))
  if (input.author) {
    fields.push(field('Editor', `${input.author.name} <${input.author.email}>`))
  }

  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `⚠️ *Strapi git sync overwrote branch changes*\n` +
          `A CMS save conflicted with commits already on the branch. Policy is that the ` +
          `CMS wins, so the editor's version was kept.`
      }
    },
    { type: 'section', fields }
  ]

  if (overwritten.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Overwritten:*\n${formatPathList(overwritten)}`
      }
    })
  }

  // Listed separately and after the hunk overwrites: these are the deletions
  // and resurrections, which are the ones worth a second look.
  if (resolved.length > 0) {
    const lines = resolved.map((r) => `${r.action.padEnd(9)} ${r.path}`)
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Existence conflicts resolved to the CMS:*\n${formatPathList(lines)}`
      }
    })
  }

  if (superseded.length > 0) {
    const [firstSha] = superseded[0].split(' ')
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Superseded commits:*\n${formatPathList(superseded)}\n` +
          `Nothing is lost from history — see what was dropped with ` +
          `\`git log -p ${firstSha} -- <path>\` and re-apply it if it is still wanted.`
      }
    })
  }

  if (input.suppressedCount) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${input.suppressedCount} further conflict(s) over the same files were suppressed since the last alert.`
        }
      ]
    })
  }

  return { text, blocks }
}

export function buildSlackPayload(input: SlackMessageInput): SlackPayload {
  const environment = process.env.NODE_ENV ?? 'unknown'

  if (input.outcome === 'conflict-resolved') return buildConflictPayload(input)

  if (input.outcome === 'healthy') {
    const text = `✅ Strapi git sync recovered on ${input.hostname}`
    return {
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `✅ *Strapi git sync recovered*` }
        },
        { type: 'section', fields: contextFields(input, environment) }
      ]
    }
  }

  const text = `❌ Strapi git sync failed on ${input.hostname}`
  const fields = contextFields(input, environment)
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

  /**
   * Posts unless an alert with the same fingerprint went out inside the
   * suppression window, in which case it only counts the repeat. Failures and
   * conflicts keep separate fingerprints, so an outage cannot bury a conflict
   * notice and vice versa.
   */
  async function postThrottled(
    url: string,
    fingerprint: string,
    alert: GitSyncAlert,
    hostname: string
  ): Promise<void> {
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

  return async function notifyGitSync(alert: GitSyncAlert): Promise<void> {
    const url = deps.webhookUrl()
    // This case is normal in local development and in CI. The startup
    // guard checks real deployments.
    if (!url) return

    const hostname = deps.hostname()

    // An audit record, not a health signal. It has to fire on a repo that was
    // never unhealthy (the normal case for a conflict), must not set
    // `unhealthy`, and must not be cleared by the next ordinary success.
    // Fingerprinted on the path set, so repeated saves to the same pages during
    // one conflict window collapse into a single notice.
    if (alert.outcome === 'conflict-resolved') {
      const paths = [
        ...(alert.overwrittenPaths ?? []),
        ...(alert.resolvedPaths ?? []).map((r) => r.path)
      ]
      await postThrottled(
        url,
        `conflict:${[...paths].sort().join(',')}`,
        alert,
        hostname
      )
      return
    }

    if (alert.outcome === 'healthy') {
      if (!unhealthy) return
      unhealthy = false
      throttle.clear()
      await post(url, buildSlackPayload({ ...alert, hostname }))
      return
    }

    unhealthy = true

    const fingerprint = redactSecrets(alert.reason ?? 'unknown failure')
    await postThrottled(url, fingerprint, alert, hostname)
  }
}

/** The notifier that git sync uses for the whole process. */
export const notifyGitSyncToSlack: NotifyGitSync = createSlackGitSyncNotifier()
