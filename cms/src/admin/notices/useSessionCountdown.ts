/**
 * Counts down to the moment this admin session goes idle-expired, and offers a
 * refresh that pushes the deadline back.
 *
 * Strapi never tells the browser when a session dies: it refreshes the access
 * token only *reactively*, after a request 401s, and exposes no session-expiry
 * API. But each refresh rotates the session row with
 * `expiresAt = now + idleLifespan` at the instant the new token's `iat` is
 * stamped, so `iat + idleLifespan` is the real deadline. See
 * `src/utils/adminSession.ts`, where all the maths and its tests live — this
 * file is React wiring only.
 */
import { attemptTokenRefresh, useAuth } from '@strapi/admin/strapi-admin'
import * as React from 'react'

import {
  formatCountdown,
  getSessionDeadlineMs,
  getSessionPhase,
  getTickIntervalMs,
  resolveIdleLifespanSeconds,
  resolveLatestIatSeconds,
  type SessionPhase
} from '../../utils/adminSession'
import { tryCatchAsync } from '../../utils/tryCatch'

const TOKEN_STORAGE_KEY = 'jwtToken'

export interface SessionCountdown {
  phase: SessionPhase
  /** Formatted time left, empty while no deadline is known. */
  label: string
  isRefreshing: boolean
  /** The last "stay signed in" attempt failed; the session itself may be fine. */
  refreshFailed: boolean
  staySignedIn: () => Promise<void>
}

function readLocalStorageToken(): string | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string) : null
  } catch {
    // Private mode, blocked site data, or a corrupt entry: treat as absent.
    return null
  }
}

function readCookieToken(): string | null {
  for (const cookie of document.cookie.split(';')) {
    const [key, value] = cookie.split('=').map((part) => part.trim())
    if (key === TOKEN_STORAGE_KEY && value) return decodeURIComponent(value)
  }
  return null
}

export function useSessionCountdown(clockOffsetMs: number): SessionCountdown {
  const reduxToken = useAuth('SessionCountdown', (state) => state.token)
  const [now, setNow] = React.useState(() => Date.now())
  const [storageNonce, setStorageNonce] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [refreshFailed, setRefreshFailed] = React.useState(false)

  const deadlineMs = React.useMemo(() => {
    const localStorageToken = readLocalStorageToken()
    const cookieToken = readCookieToken()

    // Redux alone is not enough: `storeToken` notifies a single global callback
    // owned by the tab that refreshed, so every other tab's Redux token goes
    // stale and would show a countdown for a session that is actually healthy.
    const iatSeconds = resolveLatestIatSeconds([
      localStorageToken,
      cookieToken,
      reduxToken
    ])
    if (iatSeconds instanceof Error) return null

    return getSessionDeadlineMs(
      iatSeconds,
      resolveIdleLifespanSeconds({
        hasLocalStorageToken: localStorageToken !== null,
        hasCookieToken: cookieToken !== null
      })
    )
    // `now` is in the deps so a tick re-reads storage, which is how this tab
    // notices a sibling tab's refresh when no `storage` event fires (the
    // cookie path doesn't emit one).
  }, [reduxToken, now, storageNonce])

  const remainingMs =
    deadlineMs === null ? null : deadlineMs - (now + clockOffsetMs)

  // The clock is the only thing that decides "expired". A failed refresh must
  // not: `refreshAccessToken` swallows network errors and returns null exactly
  // as it does for a dead session, so treating a failure as terminal would tell
  // someone with a perfectly good session to sign in again mid-deploy — losing
  // the very work this warning exists to protect.
  const phase: SessionPhase =
    remainingMs === null ? 'ok' : getSessionPhase(remainingMs)

  const tickIntervalMs = getTickIntervalMs(phase)

  React.useEffect(() => {
    const tick = () => setNow(Date.now())
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const handleStorage = () => setStorageNonce((nonce) => nonce + 1)

    const interval = setInterval(tick, tickIntervalMs)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [tickIntervalMs])

  const staySignedIn = React.useCallback(async () => {
    setIsRefreshing(true)
    // Rotates the refresh cookie and resets the idle window. It also stores the
    // new token and notifies Strapi's own `onTokenUpdate`, so Redux stays in
    // sync — never call `setOnTokenUpdate` here, it is a single global slot.
    const result = await tryCatchAsync(() => attemptTokenRefresh())
    setIsRefreshing(false)

    if (result instanceof Error) {
      setRefreshFailed(true)
      return
    }

    setRefreshFailed(false)
    setStorageNonce((nonce) => nonce + 1)
    setNow(Date.now())
  }, [])

  return {
    phase,
    label: remainingMs === null ? '' : formatCountdown(remainingMs),
    isRefreshing,
    refreshFailed,
    staySignedIn
  }
}
