/**
 * Decides which single notice the admin top bar shows, and whether the
 * session dialog is up.
 *
 * Kept apart from `adminSession.ts` and `serverStatus.ts` so neither has to
 * know about the other: this is the only place the two concerns meet. Browser-
 * safe; the admin imports it by relative path, not through `@/utils`.
 */
import type { SessionPhase } from './adminSession'
import type { ServerNotice } from './serverStatus'

export type AdminNotice = ServerNotice | 'session-warning'

/**
 * Server trouble outranks the session countdown. That ordering is deliberate:
 * while the CMS is unreachable a "stay signed in" button cannot work, and
 * "reload before saving" is the more urgent instruction either way.
 */
export function resolveAdminNotice(
  serverNotice: ServerNotice,
  sessionPhase: SessionPhase
): AdminNotice {
  if (serverNotice !== 'none') return serverNotice
  return sessionPhase === 'warning' ? 'session-warning' : 'none'
}

/**
 * The dialog takes over from the bar for the last couple of minutes, and once
 * the deadline has passed. It stays out of the way while the server is down —
 * a refresh cannot succeed then, and the server notice already says so.
 */
export function shouldShowSessionDialog(
  serverNotice: ServerNotice,
  sessionPhase: SessionPhase
): boolean {
  if (serverNotice === 'unreachable') return false
  return sessionPhase === 'critical' || sessionPhase === 'expired'
}
