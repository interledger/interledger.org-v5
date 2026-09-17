/**
 * Client-side state machine behind the admin's server-status notice.
 *
 * Browser-safe on purpose — the node-only half (reading the build fingerprint,
 * serving the endpoint) lives in `serverStatusEndpoint.ts` so the admin bundle
 * never pulls `fs`/`crypto` in. Admin-panel code imports this module by
 * relative path, not through `@/utils`.
 *
 * ## What the admin is actually watching for
 *
 * Deploys wipe `cms/node_modules` + `cms/dist`, rebuild the admin and restart
 * systemd. Two separate things go wrong for an editor mid-edit:
 *
 * - While the server is down, every save fails.
 * - Afterwards the browser still runs the *old* admin bundle, whose lazy chunks
 *   now 404.
 *
 * So the poll tracks two identifiers. `buildId` fingerprints the built admin
 * entry and is the only trigger for "reload before saving" — a boot id alone
 * would fire on every crash-restart and on every `strapi develop` reload.
 * `bootId` only distinguishes "the process came back" from "the network
 * blipped", and is reported after downtime we actually observed.
 */

/** Unauthenticated status route. Shared by the Koa registration and the poll. */
export const SERVER_STATUS_PATH = '/_cms-status'

/** Consecutive failed polls before we call the server unreachable. */
export const UNREACHABLE_FAILURE_THRESHOLD = 2

const HEALTHY_POLL_INTERVAL_MS = 20_000
const FAILURE_POLL_BASE_MS = 5_000
const FAILURE_POLL_MAX_MS = 30_000
const JITTER_RATIO = 0.2

export interface ServerStatusPayload {
  bootId: string
  buildId: string
  serverTime: number
}

export type ServerReachability = 'unknown' | 'healthy' | 'unreachable'

/** What the notice bar should say, highest severity first. */
export type ServerNotice = 'none' | 'outdated' | 'unreachable' | 'restarted'

export interface ServerStatusState {
  reachability: ServerReachability
  consecutiveFailures: number
  /**
   * The build this tab's bundle belongs to — pinned to the first successful
   * poll, because that is the deploy the loaded JavaScript came from.
   */
  firstBuildId: string | null
  /**
   * The process that answered the *previous* successful poll. Restart detection
   * compares against this rather than the first one ever seen: a silent restart
   * between polls moves the current process on without any downtime, and a
   * later network blip would otherwise be reported as a restart.
   */
  lastBootId: string | null
  /** Sticky: the admin bundle in this tab is stale and must be reloaded. */
  outdated: boolean
  /** Sticky: the server came back on a new process after observed downtime. */
  restarted: boolean
  /** `serverTime - clientTime` at the last success, to survive a skewed clock. */
  clockOffsetMs: number
}

export type ServerStatusEvent =
  | {
      type: 'poll-success'
      payload: ServerStatusPayload
      observedAtMs: number
    }
  | { type: 'poll-failure' }

export function createInitialServerStatusState(): ServerStatusState {
  return {
    reachability: 'unknown',
    consecutiveFailures: 0,
    firstBuildId: null,
    lastBootId: null,
    outdated: false,
    restarted: false,
    clockOffsetMs: 0
  }
}

/**
 * Validate a `/_cms-status` response body. Anything else — a proxy's HTML error
 * page, a 404 from a deploy that removed the route — must not be mistaken for a
 * healthy server *or* pin a red banner forever.
 */
export function parseServerStatusPayload(
  value: unknown
): ServerStatusPayload | Error {
  if (typeof value !== 'object' || value === null) {
    return new Error('Server status response is not an object')
  }

  const { bootId, buildId, serverTime } = value as Record<string, unknown>

  if (typeof bootId !== 'string' || bootId.length === 0) {
    return new Error('Server status response has no bootId')
  }
  if (typeof buildId !== 'string' || buildId.length === 0) {
    return new Error('Server status response has no buildId')
  }
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) {
    return new Error('Server status response has no serverTime')
  }

  return { bootId, buildId, serverTime }
}

function applyPollSuccess(
  prev: ServerStatusState,
  payload: ServerStatusPayload,
  observedAtMs: number
): ServerStatusState {
  // Neither flag can fire before there is something to compare against. A tab
  // whose very first poll lands after an outage never spoke to the previous
  // process, so it must not claim the server changed.
  const hadObservedDowntime = prev.consecutiveFailures > 0

  return {
    reachability: 'healthy',
    consecutiveFailures: 0,
    firstBuildId: prev.firstBuildId ?? payload.buildId,
    lastBootId: payload.bootId,
    outdated:
      prev.outdated ||
      (prev.firstBuildId !== null && payload.buildId !== prev.firstBuildId),
    restarted:
      prev.restarted ||
      (prev.lastBootId !== null &&
        hadObservedDowntime &&
        payload.bootId !== prev.lastBootId),
    clockOffsetMs: payload.serverTime - observedAtMs
  }
}

function applyPollFailure(prev: ServerStatusState): ServerStatusState {
  const consecutiveFailures = prev.consecutiveFailures + 1

  return {
    ...prev,
    consecutiveFailures,
    // Hold the previous verdict until the threshold, so a single dropped
    // request — or a one-second `strapi develop` reload — doesn't flash red.
    reachability:
      consecutiveFailures >= UNREACHABLE_FAILURE_THRESHOLD
        ? 'unreachable'
        : prev.reachability
  }
}

export function nextServerStatus(
  prev: ServerStatusState,
  event: ServerStatusEvent
): ServerStatusState {
  switch (event.type) {
    case 'poll-success':
      return applyPollSuccess(prev, event.payload, event.observedAtMs)
    case 'poll-failure':
      return applyPollFailure(prev)
  }
}

export function getServerNotice(state: ServerStatusState): ServerNotice {
  if (state.outdated) return 'outdated'
  if (state.reachability === 'unreachable') return 'unreachable'
  if (state.restarted) return 'restarted'
  return 'none'
}

/**
 * Back off while the server is down, with jitter so every open tab doesn't
 * hammer the box the instant systemd starts it — mid-migration is exactly when
 * a thundering herd hurts most.
 */
export function getPollDelayMs(
  state: ServerStatusState,
  random: () => number = Math.random
): number {
  if (state.consecutiveFailures === 0) return HEALTHY_POLL_INTERVAL_MS

  const backoff = Math.min(
    FAILURE_POLL_BASE_MS * 2 ** (state.consecutiveFailures - 1),
    FAILURE_POLL_MAX_MS
  )
  const jitter = backoff * JITTER_RATIO * (random() * 2 - 1)
  return Math.round(backoff + jitter)
}
