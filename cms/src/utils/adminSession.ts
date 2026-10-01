/**
 * Admin session lifespans and the client-side maths behind the session-expiry
 * notice.
 *
 * Deliberately browser-safe — no node imports, no dependencies. Two very
 * different consumers read this module:
 *
 * - `config/admin.ts` feeds the lifespans to Strapi's session manager.
 * - `src/admin/notices/*` uses them to count down to the same deadline.
 *
 * They must agree, which is the whole reason the numbers live here rather than
 * inline in the config. Admin-side code imports this file by relative path, not
 * through `@/utils`: the admin Vite build installs no tsconfig-paths plugin, and
 * the barrel would drag `fs`/`sharp`/`simple-git` into the browser bundle.
 *
 * ## Why the countdown can be exact
 *
 * Strapi 5 issues a short-lived access token (30 min) plus an httpOnly refresh
 * cookie, and refreshes *reactively* — `withTokenRefresh` only calls
 * `POST /admin/access-token` after a request 401s. Each refresh rotates the
 * session row, and `rotateRefreshToken` sets the child's
 * `expiresAt = now + idleLifespan` at the same instant `generateAccessToken`
 * stamps the new token's `iat`. So:
 *
 *     accessToken.iat + idleLifespan === session.expiresAt
 *
 * and the identity survives every rotation. The token's own `exp` is the
 * 30-minute access-token expiry and has nothing to do with the session — using
 * it is the obvious wrong simplification, so a test pins that down.
 */

/** No "remember me": Strapi's `session` token family. Set in `config/admin.ts`. */
export const IDLE_SESSION_LIFESPAN_SECONDS = 259_200 // 72 hours

/**
 * With "remember me": Strapi's `refresh` token family. We don't configure
 * `idleRefreshTokenLifespan`, so this mirrors Strapi's own default.
 */
export const IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS = 1_209_600 // 14 days

/** Absolute ceiling on a session regardless of activity. Set in `config/admin.ts`. */
export const MAX_SESSION_LIFESPAN_SECONDS = 63_072_000 // 2 years

/** Show the warning bar this far ahead of the deadline. */
export const SESSION_WARNING_THRESHOLD_MS = 30 * 60 * 1000

/** Escalate to the blocking dialog this far ahead of the deadline. */
export const SESSION_CRITICAL_THRESHOLD_MS = 2 * 60 * 1000

export type SessionPhase = 'ok' | 'warning' | 'critical' | 'expired'

/** The subset of Strapi's access-token payload the countdown relies on. */
export interface AccessTokenPayload {
  userId: string
  sessionId: string
  type: 'access'
  iat: number
  exp: number
}

/** Which of the two token storage slots currently holds a token. */
export interface TokenStorageState {
  hasLocalStorageToken: boolean
  hasCookieToken: boolean
}

const JWT_SEGMENT_COUNT = 3

function decodeBase64UrlSegment(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  // Decode as UTF-8 rather than trusting atob's latin-1 output, so a non-ASCII
  // claim can't corrupt the JSON.
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    payload.type === 'access' &&
    typeof payload.iat === 'number' &&
    Number.isFinite(payload.iat)
  )
}

/**
 * Read the claims out of an admin access token. The token is a plain JWT, so
 * this is a decode, never a verification — the server remains the only thing
 * that decides whether a session is valid.
 */
export function decodeAccessTokenPayload(
  token: string
): AccessTokenPayload | Error {
  if (typeof token !== 'string' || token.length === 0) {
    return new Error('Access token is empty')
  }

  const segments = token.split('.')
  if (segments.length !== JWT_SEGMENT_COUNT) {
    return new Error(
      `Access token has ${segments.length} segments, expected ${JWT_SEGMENT_COUNT}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64UrlSegment(segments[1]))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return new Error(`Access token payload is not valid JSON: ${reason}`)
  }

  if (!isAccessTokenPayload(parsed)) {
    return new Error('Access token payload is not an access-token claim set')
  }

  return parsed
}

/**
 * Pick the freshest `iat` across every token slot we can see.
 *
 * Needed because `storeToken` notifies a *single global* `onTokenUpdate`
 * callback owned by the current tab's AuthProvider. When one tab refreshes, the
 * other tabs' Redux token goes stale — trusting it alone would pop the expiry
 * dialog on a perfectly healthy session. Undecodable slots are skipped rather
 * than failing the whole read; only an empty result is an error.
 */
export function resolveLatestIatSeconds(
  tokens: ReadonlyArray<string | null | undefined>
): number | Error {
  let latest: number | null = null

  for (const token of tokens) {
    if (!token) continue
    const payload = decodeAccessTokenPayload(token)
    if (payload instanceof Error) continue
    if (latest === null || payload.iat > latest) latest = payload.iat
  }

  return latest ?? new Error('No decodable access token found')
}

/**
 * How long a session survives without a refresh, given where the token is kept.
 *
 * Strapi picks the token family at login from the "Remember me" checkbox and
 * stores the token accordingly: localStorage when remembered, a cookie
 * otherwise. Both slots can hold a token at once, because Strapi's `login`
 * reducer writes one without clearing the other (only `logout` clears both) —
 * so a remembered login followed by a non-remembered one leaves a stale
 * localStorage entry. When it's ambiguous we assume the *shorter* lifespan:
 * warning early is harmless, warning too late is the failure this exists to
 * prevent.
 */
export function resolveIdleLifespanSeconds({
  hasLocalStorageToken,
  hasCookieToken
}: TokenStorageState): number {
  const idleLifespan =
    hasLocalStorageToken && !hasCookieToken
      ? IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS
      : IDLE_SESSION_LIFESPAN_SECONDS

  // The absolute ceiling wins if it is ever configured below the idle window.
  return Math.min(idleLifespan, MAX_SESSION_LIFESPAN_SECONDS)
}

/**
 * Wall-clock instant the session dies unless something refreshes it.
 *
 * Models the idle deadline only. Strapi also enforces an absolute one —
 * `absoluteExpiresAt = loginAt + maxSessionLifespan`, carried across every
 * rotation — which this cannot see: the access token payload is just
 * `{ userId, sessionId, type, iat, exp }`, and no endpoint reports the session
 * row, so `loginAt` is simply not available to the browser. Surfacing it would
 * need a new authenticated route.
 *
 * Left unmodelled deliberately. It can only bind after a single session chain
 * has been refreshed continuously for the full two years, at least once every
 * idle window. The realistic version of this problem — `maxSessionLifespan`
 * configured *below* the idle window — is handled, by the clamp in
 * `resolveIdleLifespanSeconds`.
 */
export function getSessionDeadlineMs(
  iatSeconds: number,
  idleLifespanSeconds: number
): number {
  return (iatSeconds + idleLifespanSeconds) * 1000
}

/**
 * How often the countdown should recompute. A 30-second tick is plenty while
 * the deadline is hours away; once the dialog is up and counting down from two
 * minutes, the displayed number has to move every second.
 */
export function getTickIntervalMs(phase: SessionPhase): number {
  return phase === 'critical' ? 1_000 : 30_000
}

export function getSessionPhase(remainingMs: number): SessionPhase {
  if (remainingMs <= 0) return 'expired'
  if (remainingMs <= SESSION_CRITICAL_THRESHOLD_MS) return 'critical'
  if (remainingMs <= SESSION_WARNING_THRESHOLD_MS) return 'warning'
  return 'ok'
}

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

/** Human-readable time left, for the notice bar and the dialog. */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '0s'

  const totalSeconds = Math.ceil(remainingMs / MS_PER_SECOND)
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)

  if (totalMinutes < 1) return `${totalSeconds}s`
  if (totalMinutes < MINUTES_PER_HOUR) return `${totalMinutes}m`

  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
