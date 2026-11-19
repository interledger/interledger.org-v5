import fs from 'fs'
import os from 'os'
import path from 'path'
import { tryCatch, tryCatchAsync } from './tryCatch'

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
/** This value keeps the start of a failure reason, where the cause is stated. */
const MAX_REASON_CHARS = 500
/** A Slack section block rejects text over 3000 characters. A long path list has to stop somewhere. */
const MAX_LISTED_PATHS = 20
/**
 * Character budget for one rendered list, well inside the 3000-character
 * section limit so the surrounding heading and hint text still fit.
 */
const MAX_LIST_CHARS = 2_000

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
  /**
   * The conflict probe could not enumerate what was overwritten, so the lists
   * above are incomplete. The message says so rather than implying the
   * overwrite was empty.
   */
  detailsUnavailable?: boolean
  /**
   * The overwrite is decided and staged, but the push failed. It reaches the
   * branch with the next successful save, which announces nothing, so this
   * alert is sent now and says so.
   */
  pendingPush?: boolean
}

export type NotifyGitSync = (alert: GitSyncAlert) => Promise<void>

/**
 * Groups repeated conflicts over the same files into one notice.
 *
 * Normally the path set and the superseded commits are the identity. The
 * commits matter: a second overwrite of the same file that supersedes a
 * different developer commit is new lost work, and an audit record that only
 * counted it would never name that commit anywhere. When the probe could not enumerate
 * paths there is no set, and keying on it alone would give every such alert the
 * same fingerprint — so unrelated saves would suppress one another for fifteen
 * minutes, and the first save's commit and editor would stand in for all of
 * them. The commit message discriminates those.
 */
export function conflictFingerprint(alert: GitSyncAlert): string {
  const paths = [
    ...(alert.overwrittenPaths ?? []),
    ...(alert.resolvedPaths ?? []).map((r) => r.path)
  ]
  if (paths.length > 0) {
    const commits = [...(alert.supersededCommits ?? [])].sort().join(',')
    return `conflict:${[...new Set(paths)].sort().join(',')}:${commits}`
  }
  return `conflict:unlisted:${alert.label}:${alert.commitMessage ?? ''}`
}

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
  /** The branch checked out in `repoRoot`, or `null` when it cannot be read. */
  branch: (repoRoot: string) => string | null
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
  /**
   * The deploy branch, which is what tells staging and playground apart: both
   * hosts run with `NODE_ENV=production`, so that value names neither.
   */
  branch?: string | null
  /** The number of repeat alerts the throttle blocked since the last post. */
  suppressedCount?: number
}

function field(label: string, value: string) {
  return { type: 'mrkdwn', text: `*${label}:*\n${value}` }
}

/**
 * Renders a path list as a code block that fits inside a Slack section.
 *
 * Capped by characters as well as entries: a section rejects text over 3000
 * characters, and twenty long paths or commit subjects reach that on their own
 * — which would drop the alert exactly when it matters.
 */
export function formatPathList(paths: string[]): string {
  const shown: string[] = []
  let budget = MAX_LIST_CHARS

  for (const line of paths.slice(0, MAX_LISTED_PATHS)) {
    if (budget - line.length < 0) break
    shown.push(line)
    budget -= line.length + 1 // the newline joining it to the previous entry
  }

  const overflow = paths.length - shown.length
  const lines = overflow > 0 ? [...shown, `…and ${overflow} more`] : shown
  return `\`\`\`${lines.join('\n')}\`\`\``
}

/** The identifying context fields every alert carries. */
function contextFields(input: SlackMessageInput) {
  return [
    field('Host', input.hostname),
    field('Branch', input.branch ?? 'unknown'),
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
  const overwritten = input.overwrittenPaths ?? []
  const resolved = input.resolvedPaths ?? []
  const superseded = input.supersededCommits ?? []

  // Counted over the union: the two lists are kept disjoint upstream, but a
  // path present in both must still be one file here, not two.
  const affected = new Set([...overwritten, ...resolved.map((r) => r.path)])

  // A distinct emoji and verb from both other states (❌ failed, ✅ recovered)
  // so the channel reads at a glance.
  const text = input.detailsUnavailable
    ? `⚠️ Strapi git sync may have overwritten branch changes on ${input.hostname}`
    : `⚠️ Strapi git sync overwrote ${affected.size} file(s) on ${input.hostname}`

  const fields = contextFields(input)
  if (input.commitMessage) fields.push(field('Commit', input.commitMessage))
  if (input.author) {
    fields.push(field('Editor', `${input.author.name} <${input.author.email}>`))
  }

  // The unavailable-details wording must not point at anything it cannot show:
  // when the probe fails there are no paths and usually no superseded commits
  // either, so it names the commit that won and how to look the rest up.
  const headline = input.detailsUnavailable
    ? `⚠️ *Strapi git sync may have overwritten branch changes*\n` +
      `A CMS save was rebased onto commits already on the branch and the CMS wins ` +
      `any conflict, but this checkout's git is too old to list what was overwritten ` +
      `(\`git merge-tree --write-tree\` needs git 2.38+). Find the commit named below ` +
      `with \`git log --oneline\` on the deploy branch and check what it replaced; ` +
      `upgrading git on this host restores the file list.`
    : `⚠️ *Strapi git sync overwrote branch changes*\n` +
      `A CMS save conflicted with commits already on the branch. Policy is that the ` +
      `CMS wins, so the editor's version was kept.`
  const pending = input.pendingPush
    ? `\n*Not pushed yet:* the push failed (see the failure alert), and the ` +
      `next successful save pushes this overwrite without another notice.`
    : ''

  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: headline + pending } },
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

/**
 * The failure headline. The reason is stated here, not only in the detail
 * block: a killed or silent command has no output, so the block can be empty,
 * and for a refusal the reason is the only text saying what a human must do.
 */
function failureHeadline(input: SlackMessageInput): string {
  const branch = input.branch
    ? `the \`${input.branch}\` branch`
    : 'the deploy branch'
  const lines = [
    `❌ *Strapi git sync failed*`,
    `Content changes are not reaching ${branch}.`
  ]
  if (input.reason) {
    const reason = redactSecrets(input.reason.trim())
    lines.push(
      `*Reason:* ${reason.length > MAX_REASON_CHARS ? `${reason.slice(0, MAX_REASON_CHARS)}…` : reason}`
    )
  }
  return lines.join('\n')
}

export function buildSlackPayload(input: SlackMessageInput): SlackPayload {
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
        { type: 'section', fields: contextFields(input) }
      ]
    }
  }

  const text = `❌ Strapi git sync failed on ${input.hostname}`
  const fields = contextFields(input)
  if (input.commitMessage) fields.push(field('Commit', input.commitMessage))
  if (input.author) {
    fields.push(field('Editor', `${input.author.name} <${input.author.email}>`))
  }

  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: failureHeadline(input) } },
    { type: 'section', fields }
  ]

  // Git's output is stdout and stderr joined by a newline, so a command that
  // printed nothing still arrives as non-empty text.
  const detail = truncateDetail(redactSecrets(input.detail ?? ''))
  if (detail) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`${detail}\`\`\`` }
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

/**
 * Mid-rebase HEAD is detached, and that is exactly when a failure is likely,
 * so the branch being rebased is read from the rebase state as a fallback.
 */
const BRANCH_REF_FILES = [
  'HEAD',
  'rebase-merge/head-name',
  'rebase-apply/head-name'
] as const
const BRANCH_REF = /^(?:ref: )?refs\/heads\/(.+)$/

export function readCheckedOutBranch(repoRoot: string): string | null {
  for (const file of BRANCH_REF_FILES) {
    const contents = tryCatch(() =>
      fs.readFileSync(path.join(repoRoot, '.git', file), 'utf8')
    )
    if (contents instanceof Error) continue
    const match = BRANCH_REF.exec(contents.trim())
    if (match) return match[1]
  }
  return null
}

const defaultNotifierDeps: SlackNotifierDeps = {
  fetch: (url, init) => fetch(url, init),
  now: () => Date.now(),
  webhookUrl: getSlackWebhookUrl,
  hostname: () => os.hostname(),
  branch: readCheckedOutBranch
}

interface ThrottleEntry {
  lastSentAt: number
  suppressedCount: number
}

/**
 * Drops entries whose window has passed. Each conflict has its own
 * fingerprint, so without this the maps grow for the life of the process. An
 * expired entry no longer suppresses anything; all it still holds is a repeat
 * count that would only be shown if the same alert came back.
 */
function pruneExpired(throttle: Map<string, ThrottleEntry>, now: number): void {
  for (const [fingerprint, entry] of throttle) {
    if (now - entry.lastSentAt >= REPEAT_SUPPRESSION_MS) {
      throttle.delete(fingerprint)
    }
  }
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
  // Two maps, not one. A recovery clears the failure throttle so the next
  // outage alerts immediately; sharing one map would let that same recovery
  // erase the conflict fingerprints and re-post a conflict already announced.
  const failureThrottle = new Map<string, ThrottleEntry>()
  const conflictThrottle = new Map<string, ThrottleEntry>()
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
    throttle: Map<string, ThrottleEntry>,
    fingerprint: string,
    alert: GitSyncAlert,
    where: { hostname: string; branch: string | null }
  ): Promise<void> {
    const entry = throttle.get(fingerprint)
    const now = deps.now()

    if (entry && now - entry.lastSentAt < REPEAT_SUPPRESSION_MS) {
      entry.suppressedCount += 1
      return
    }

    pruneExpired(throttle, now)
    throttle.set(fingerprint, { lastSentAt: now, suppressedCount: 0 })
    await post(
      url,
      buildSlackPayload({
        ...alert,
        ...where,
        suppressedCount: entry?.suppressedCount ?? 0
      })
    )
  }

  return async function notifyGitSync(alert: GitSyncAlert): Promise<void> {
    const url = deps.webhookUrl()
    // This case is normal in local development and in CI. The startup
    // guard checks real deployments.
    if (!url) return

    const where = {
      hostname: deps.hostname(),
      branch: deps.branch(alert.repoRoot)
    }

    // An audit record, not a health signal. It has to fire on a repo that was
    // never unhealthy (the normal case for a conflict), must not set
    // `unhealthy`, and must not be cleared by the next ordinary success.
    // Fingerprinted on the paths and superseded commits, so a repeat of the
    // same overwrite collapses into one notice but a new one never does.
    if (alert.outcome === 'conflict-resolved') {
      await postThrottled(
        url,
        conflictThrottle,
        conflictFingerprint(alert),
        alert,
        where
      )
      return
    }

    if (alert.outcome === 'healthy') {
      if (!unhealthy) return
      unhealthy = false
      // Only the failure fingerprints. Conflict notices are an audit trail,
      // not a health signal, and must survive an unrelated recovery.
      failureThrottle.clear()
      await post(url, buildSlackPayload({ ...alert, ...where }))
      return
    }

    unhealthy = true

    const fingerprint = redactSecrets(alert.reason ?? 'unknown failure')
    await postThrottled(url, failureThrottle, fingerprint, alert, where)
  }
}

/** The notifier that git sync uses for the whole process. */
export const notifyGitSyncToSlack: NotifyGitSync = createSlackGitSyncNotifier()
