/**
 * Server half of the admin's server-status notice: the build fingerprint and
 * the Koa handler behind `SERVER_STATUS_PATH`.
 *
 * Node-only — keep it out of anything the admin bundle imports. The pure state
 * machine the browser needs lives in `serverStatus.ts`.
 *
 * The endpoint is deliberately **unauthenticated**. An authenticated poll would
 * 401 every 30 minutes, trip Strapi's reactive token refresh, and roll the idle
 * window forward — making sessions effectively immortal and the companion
 * session-expiry warning unreachable. Both identifiers it returns are opaque
 * (a per-process UUID and a content hash), and it reports no uptime.
 */
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

import type { ServerStatusPayload } from './serverStatus'

/**
 * Build id reported when no built admin exists — the `strapi develop` case.
 * Constant by design: it stops the "reload before saving" notice from firing on
 * every dev-server restart.
 */
export const DEV_BUILD_ID = 'dev'

const BUILD_ID_LENGTH = 16

/** Minimal Koa surface the handler touches. */
export interface ServerStatusContext {
  set: (field: string, value: string) => void
  body?: unknown
}

/** Where `strapi build` writes the admin entry, relative to the cms root. */
export function resolveAdminIndexHtmlPath(cmsRoot: string): string {
  return path.join(cmsRoot, 'dist', 'build', 'index.html')
}

/**
 * Fingerprint the built admin entry. Its `<script src>` carries Vite's content
 * hash, so the digest changes on every rebuild and on nothing else.
 *
 * A missing file is not a failure — it means the admin was never built here, so
 * there is no bundle to go stale. A file that exists but can't be read is a
 * real failure and is returned as one.
 */
export function readAdminBuildId(indexHtmlPath: string): string | Error {
  if (!existsSync(indexHtmlPath)) return DEV_BUILD_ID

  try {
    const contents = readFileSync(indexHtmlPath)
    return createHash('sha256')
      .update(contents)
      .digest('hex')
      .slice(0, BUILD_ID_LENGTH)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return new Error(
      `Could not read the admin build at ${indexHtmlPath}: ${reason}`
    )
  }
}

export function createServerStatusHandler(
  identity: Omit<ServerStatusPayload, 'serverTime'>,
  now: () => number = Date.now
): (ctx: ServerStatusContext) => void {
  return (ctx) => {
    ctx.set('Cache-Control', 'no-store')
    ctx.body = {
      bootId: identity.bootId,
      buildId: identity.buildId,
      serverTime: now()
    } satisfies ServerStatusPayload
  }
}
