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

function isDisabled(): boolean {
  // `typeof` guard first: Vite only replaces env vars it knows about, so an
  // unset one would otherwise hit an undefined `process` in the browser.
  return (
    typeof process !== 'undefined' &&
    process.env?.STRAPI_ADMIN_DISABLE_NOTICES === 'true'
  )
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
    if (isDisabled()) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let latest = createInitialServerStatusState()

    const apply = (next: ServerStatusState) => {
      latest = next
      setState(next)
    }

    const poll = async () => {
      if (cancelled) return

      const result = await fetchServerStatus()
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

      timer = setTimeout(poll, getPollDelayMs(latest))
    }

    const pollNow = () => {
      if (timer) clearTimeout(timer)
      void poll()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') pollNow()
    }

    // Vite fires this when a lazy chunk 404s — direct proof this tab's bundle
    // no longer matches what the server is serving.
    const handleAssetLoadFailure = () => {
      apply(nextServerStatus(latest, { type: 'asset-load-failure' }))
    }

    void poll()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', pollNow)
    window.addEventListener('vite:preloadError', handleAssetLoadFailure)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', pollNow)
      window.removeEventListener('vite:preloadError', handleAssetLoadFailure)
    }
  }, [])

  return {
    notice: getServerNotice(state),
    clockOffsetMs: state.clockOffsetMs
  }
}
