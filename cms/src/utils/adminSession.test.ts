import { describe, expect, it } from 'vitest'
import {
  IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS,
  IDLE_SESSION_LIFESPAN_SECONDS,
  MAX_SESSION_LIFESPAN_SECONDS,
  SESSION_CRITICAL_THRESHOLD_MS,
  SESSION_WARNING_THRESHOLD_MS,
  decodeAccessTokenPayload,
  formatCountdown,
  getSessionDeadlineMs,
  getSessionPhase,
  getTickIntervalMs,
  resolveIdleLifespanSeconds,
  resolveLatestIatSeconds
} from './adminSession'

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function makeToken(payload: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify(payload)),
    'signature-not-verified'
  ].join('.')
}

function makeAccessToken(
  iat: number,
  overrides: Record<string, unknown> = {}
): string {
  return makeToken({
    userId: '1',
    sessionId: 'a'.repeat(32),
    type: 'access',
    iat,
    exp: iat + 1800,
    ...overrides
  })
}

// ── decodeAccessTokenPayload ────────────────────────────────────────────────

describe('decodeAccessTokenPayload', () => {
  it('reads the claims out of a well-formed access token', () => {
    const payload = decodeAccessTokenPayload(makeAccessToken(1_700_000_000))

    expect(payload).not.toBeInstanceOf(Error)
    expect(payload).toMatchObject({
      userId: '1',
      type: 'access',
      iat: 1_700_000_000
    })
  })

  it('decodes payloads containing non-ASCII characters', () => {
    const token = makeAccessToken(1_700_000_000, { note: 'café — ok' })
    const payload = decodeAccessTokenPayload(token)

    expect(payload).not.toBeInstanceOf(Error)
    expect((payload as Record<string, unknown>).note).toBe('café — ok')
  })

  it('returns an Error for an empty token', () => {
    expect(decodeAccessTokenPayload('')).toBeInstanceOf(Error)
  })

  it('returns an Error for a token with the wrong segment count', () => {
    const twoSegments = makeAccessToken(1).split('.').slice(0, 2).join('.')
    const result = decodeAccessTokenPayload(twoSegments)

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('2 segments')
  })

  it('returns an Error when the payload is not JSON', () => {
    const token = ['header', base64Url('not json at all'), 'sig'].join('.')
    const result = decodeAccessTokenPayload(token)

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('not valid JSON')
  })

  it('rejects a refresh token — only access tokens carry the session iat', () => {
    const token = makeToken({ type: 'refresh', iat: 1_700_000_000 })

    expect(decodeAccessTokenPayload(token)).toBeInstanceOf(Error)
  })

  it('rejects a payload with a missing or non-numeric iat', () => {
    expect(
      decodeAccessTokenPayload(makeToken({ type: 'access' }))
    ).toBeInstanceOf(Error)
    expect(
      decodeAccessTokenPayload(makeToken({ type: 'access', iat: 'soon' }))
    ).toBeInstanceOf(Error)
  })
})

// ── resolveLatestIatSeconds ─────────────────────────────────────────────────

describe('resolveLatestIatSeconds', () => {
  it('takes the freshest iat so a stale tab follows a sibling refresh', () => {
    const stale = makeAccessToken(1_700_000_000)
    const fresh = makeAccessToken(1_700_003_600)

    expect(resolveLatestIatSeconds([stale, fresh])).toBe(1_700_003_600)
    expect(resolveLatestIatSeconds([fresh, stale])).toBe(1_700_003_600)
  })

  it('skips empty and undecodable slots', () => {
    const valid = makeAccessToken(1_700_000_000)

    expect(resolveLatestIatSeconds([null, undefined, '', 'junk', valid])).toBe(
      1_700_000_000
    )
  })

  it('returns an Error when nothing decodes', () => {
    expect(resolveLatestIatSeconds([])).toBeInstanceOf(Error)
    expect(resolveLatestIatSeconds([null, 'junk'])).toBeInstanceOf(Error)
  })
})

// ── resolveIdleLifespanSeconds ──────────────────────────────────────────────

describe('resolveIdleLifespanSeconds', () => {
  it('uses the 14-day window only for a localStorage-only token', () => {
    expect(
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: true,
        hasCookieToken: false
      })
    ).toBe(IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS)
  })

  it('uses the 72-hour window for a cookie-only token', () => {
    expect(
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: false,
        hasCookieToken: true
      })
    ).toBe(IDLE_SESSION_LIFESPAN_SECONDS)
  })

  it('assumes the shorter window when both slots are populated', () => {
    // Reachable in practice: Strapi's login reducer writes one slot without
    // clearing the other, so a remembered login followed by a plain one leaves
    // a stale localStorage token behind.
    expect(
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: true,
        hasCookieToken: true
      })
    ).toBe(IDLE_SESSION_LIFESPAN_SECONDS)
  })

  it('assumes the shorter window when neither slot is populated', () => {
    expect(
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: false,
        hasCookieToken: false
      })
    ).toBe(IDLE_SESSION_LIFESPAN_SECONDS)
  })

  it('never exceeds the absolute session ceiling', () => {
    expect(IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS).toBeLessThanOrEqual(
      MAX_SESSION_LIFESPAN_SECONDS
    )
    expect(
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: true,
        hasCookieToken: false
      })
    ).toBeLessThanOrEqual(MAX_SESSION_LIFESPAN_SECONDS)
  })
})

// ── getSessionDeadlineMs ────────────────────────────────────────────────────

describe('getSessionDeadlineMs', () => {
  it('projects the deadline from iat, not from the token exp', () => {
    const iat = 1_700_000_000
    const deadline = getSessionDeadlineMs(iat, IDLE_SESSION_LIFESPAN_SECONDS)

    expect(deadline).toBe((iat + IDLE_SESSION_LIFESPAN_SECONDS) * 1000)
  })

  it('ignores exp entirely — exp is the 30-minute access-token expiry', () => {
    const iat = 1_700_000_000
    const shortLived = decodeAccessTokenPayload(
      makeAccessToken(iat, { exp: iat + 60 })
    )

    expect(shortLived).not.toBeInstanceOf(Error)
    expect(
      getSessionDeadlineMs(
        (shortLived as { iat: number }).iat,
        IDLE_SESSION_LIFESPAN_SECONDS
      )
    ).toBe((iat + IDLE_SESSION_LIFESPAN_SECONDS) * 1000)
  })
})

// ── getSessionPhase ─────────────────────────────────────────────────────────

describe('getSessionPhase', () => {
  it('stays quiet while there is plenty of time left', () => {
    expect(getSessionPhase(SESSION_WARNING_THRESHOLD_MS + 1)).toBe('ok')
  })

  it('warns from the warning threshold down to the critical threshold', () => {
    expect(getSessionPhase(SESSION_WARNING_THRESHOLD_MS)).toBe('warning')
    expect(getSessionPhase(SESSION_CRITICAL_THRESHOLD_MS + 1)).toBe('warning')
  })

  it('escalates at the critical threshold', () => {
    expect(getSessionPhase(SESSION_CRITICAL_THRESHOLD_MS)).toBe('critical')
    expect(getSessionPhase(1)).toBe('critical')
  })

  it('reports expired at and past the deadline', () => {
    expect(getSessionPhase(0)).toBe('expired')
    expect(getSessionPhase(-5000)).toBe('expired')
  })
})

// ── getTickIntervalMs ───────────────────────────────────────────────────────

describe('getTickIntervalMs', () => {
  it('ticks every second only once the dialog is counting down', () => {
    expect(getTickIntervalMs('critical')).toBe(1_000)
  })

  it('ticks slowly the rest of the time', () => {
    expect(getTickIntervalMs('ok')).toBe(30_000)
    expect(getTickIntervalMs('warning')).toBe(30_000)
    expect(getTickIntervalMs('expired')).toBe(30_000)
  })
})

// ── formatCountdown ─────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('counts seconds under a minute', () => {
    expect(formatCountdown(45_000)).toBe('45s')
    expect(formatCountdown(500)).toBe('1s')
  })

  it('counts whole minutes under an hour', () => {
    expect(formatCountdown(60_000)).toBe('1m')
    expect(formatCountdown(29 * 60_000)).toBe('29m')
  })

  it('counts hours and minutes past an hour', () => {
    expect(formatCountdown(2 * 3_600_000)).toBe('2h')
    expect(formatCountdown(2 * 3_600_000 + 15 * 60_000)).toBe('2h 15m')
  })

  it('floors at zero rather than going negative', () => {
    expect(formatCountdown(0)).toBe('0s')
    expect(formatCountdown(-1000)).toBe('0s')
  })
})
