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

export type AdminNotice = ServerNotice | 'session-warning' | 'session-expired'

/** Build-time kill switch, checked once before the notices layout is mounted. */
export const DISABLE_NOTICES_ENV_VAR = 'STRAPI_ADMIN_DISABLE_NOTICES'

/**
 * Whether to skip the notices entirely — no bar, no dialog, no polling.
 *
 * Takes the env bag rather than reading `process.env` itself: Vite only inlines
 * the `STRAPI_ADMIN_*` vars it knows about, so an unset one leaves `process`
 * undefined in the browser and the caller has to guard for that.
 */
export function areAdminNoticesDisabled(
  env: Record<string, string | undefined> | undefined
): boolean {
  return env?.[DISABLE_NOTICES_ENV_VAR] === 'true'
}

/**
 * Ordering, most urgent first: unreachable, session-expired, outdated,
 * session-warning, restarted.
 *
 * `unreachable` leads because nothing else can succeed while the server is
 * down — not a reload, not a sign-in, not a refresh. An expired session comes
 * next: a reload would land on the login page anyway, so signing in is the one
 * step the editor has to take. The bar only shows it once the editor has
 * closed the expiry dialog to copy their work; until then the dialog covers it.
 *
 * `restarted` ranks *below* the countdown: it is a purely informational "retry
 * that save", whereas an expiring session is time-critical. That is also what
 * keeps a dismissal from masking later trouble — `restarted` is sticky, so if
 * it outranked the warning, dismissing it once would suppress the session bar
 * for the rest of the session.
 */
export function resolveAdminNotice(
  serverNotice: ServerNotice,
  sessionPhase: SessionPhase
): AdminNotice {
  if (serverNotice === 'unreachable') return serverNotice
  if (sessionPhase === 'expired') return 'session-expired'
  if (serverNotice === 'outdated') return serverNotice
  if (sessionPhase === 'warning') return 'session-warning'
  return serverNotice
}

/**
 * The dialog takes over from the bar for the last couple of minutes, and once
 * the deadline has passed. It stays out of the way while the server is down —
 * a refresh cannot succeed then, and the server notice already says so.
 *
 * Only the expired dialog can be closed, so the editor can copy unsaved work
 * out of the form; the bar keeps the sign-in one click away. The critical
 * dialog has a working "stay signed in" button, so there is nothing to close
 * it for.
 */
export function shouldShowSessionDialog(
  serverNotice: ServerNotice,
  sessionPhase: SessionPhase,
  hasDismissedExpiredDialog: boolean
): boolean {
  if (serverNotice === 'unreachable') return false
  if (sessionPhase === 'expired') return !hasDismissedExpiredDialog
  return sessionPhase === 'critical'
}
