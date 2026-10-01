/**
 * Polls the CMS for reachability and build identity, so the admin can warn an
 * editor before a save fails against a restarting or freshly-redeployed server.
 *
 * All the decisions live in `src/utils/serverStatus.ts`, which is unit-tested;
 * this file is scheduling and event wiring only. It imports that module by
 * relative path rather than through `@/utils` — the admin Vite build has no
 * tsconfig-paths plugin, and the barrel would drag node-only modules into the
 * browser bundle.
 */
import * as React from 'react'

import { tryCatchAsync } from '../../utils/tryCatch'
import {
  SERVER_STATUS_PATH,
  createInitialServerStatusState,
  getPollDelayMs,
  getServerNotice,
  nextServerStatus,
  parseServerStatusPayload,
  type ServerNotice,
  type ServerStatusPayload,
  type ServerStatusState
} from '../../utils/serverStatus'

const REQUEST_TIMEOUT_MS = 5_000

export interface ServerStatus {
  notice: ServerNotice
  /** `serverTime - clientTime`, so the session countdown survives a skewed clock. */
  clockOffsetMs: number
}

function getBackendUrl(): string {
  const strapiGlobal = (
    window as unknown as { strapi?: { backendURL?: string } }
  ).strapi
  return strapiGlobal?.backendURL ?? window.location.origin
}

async function fetchServerStatus(): Promise<ServerStatusPayload | Error> {
  // Cache-buster on top of the endpoint's `no-store`: some proxies cache a
  // 200 GET regardless, which would freeze the reported identity.
  const url = `${getBackendUrl()}${SERVER_STATUS_PATH}?t=${Date.now()}`

  const response = await tryCatchAsync(() =>
    fetch(url, {
      // Load-bearing. The default `same-origin` would send the session cookie,
      // and an authenticated poll would refresh the token every 30 minutes —
      // rolling the idle window forward forever and making the companion
      // session-expiry warning unreachable.
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  )
  if (response instanceof Error) return response

  if (!response.ok) {
    return new Error(`Server status responded ${response.status}`)
  }

  // A proxy's HTML error page parses as neither JSON nor a valid payload;
  // check the type first so the failure reads as "unreachable", not "corrupt".
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return new Error(
      `Server status returned ${contentType || 'no content type'}`
    )
  }

  const body = await tryCatchAsync(() => response.json())
  if (body instanceof Error) return body

  return parseServerStatusPayload(body)
}

export function useServerStatus(): ServerStatus {
  const [state, setState] = React.useState<ServerStatusState>(
    createInitialServerStatusState
  )

  React.useEffect(() => {
    let cancelled = false
    let isPolling = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let latest = createInitialServerStatusState()

    const apply = (next: ServerStatusState) => {
      latest = next
      setState(next)
    }

    const poll = async () => {
      // One request at a time. Without this, a visibility or online event
      // arriving mid-request starts a second poll: both would then apply their
      // results in whatever order the network returns them (a stale failure
      // landing after a fresh success could push the failure counter to
      // "unreachable" against a healthy server) and both would schedule a
      // follow-up, permanently doubling the polling rate.
      if (cancelled || isPolling) return
      isPolling = true

      let result: Awaited<ReturnType<typeof fetchServerStatus>>
      try {
        result = await fetchServerStatus()
      } finally {
        isPolling = false
      }
      if (cancelled) return

      apply(
        nextServerStatus(
          latest,
          result instanceof Error
            ? { type: 'poll-failure' }
            : {
                type: 'poll-success',
                payload: result,
                observedAtMs: Date.now()
              }
        )
      )

      if (timer) clearTimeout(timer)
      timer = setTimeout(poll, getPollDelayMs(latest))
    }

    // Skipped while a request is already in flight — its result is moments
    // away and will reschedule the loop itself.
    const pollNow = () => {
      if (timer) clearTimeout(timer)
      void poll()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') pollNow()
    }

    void poll()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', pollNow)
    // Vite fires this when a lazy chunk fails to load. That usually means a
    // deploy replaced the bundle, but a transient outage looks identical — so
    // ask the server rather than assuming. Telling someone to reload when the
    // build never changed would destroy the unsaved work this is meant to
    // protect; the poll confirms it within a second if the build really moved.
    window.addEventListener('vite:preloadError', pollNow)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', pollNow)
      window.removeEventListener('vite:preloadError', pollNow)
    }
  }, [])

  return {
    notice: getServerNotice(state),
    clockOffsetMs: state.clockOffsetMs
  }
}
