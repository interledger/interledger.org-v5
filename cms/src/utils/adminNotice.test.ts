import { describe, expect, it } from 'vitest'
import {
  DISABLE_NOTICES_ENV_VAR,
  areAdminNoticesDisabled,
  resolveAdminNotice,
  shouldShowSessionDialog
} from './adminNotice'

// ── areAdminNoticesDisabled ─────────────────────────────────────────────────

describe('areAdminNoticesDisabled', () => {
  it('disables the notices only for the exact string "true"', () => {
    expect(areAdminNoticesDisabled({ [DISABLE_NOTICES_ENV_VAR]: 'true' })).toBe(
      true
    )
    expect(
      areAdminNoticesDisabled({ [DISABLE_NOTICES_ENV_VAR]: 'false' })
    ).toBe(false)
    expect(areAdminNoticesDisabled({ [DISABLE_NOTICES_ENV_VAR]: '1' })).toBe(
      false
    )
  })

  it('stays enabled when the variable is unset', () => {
    expect(areAdminNoticesDisabled({})).toBe(false)
  })

  it('stays enabled when there is no env at all', () => {
    // Vite leaves `process` undefined in the browser for vars it did not
    // inline, so the caller can legitimately pass nothing.
    expect(areAdminNoticesDisabled(undefined)).toBe(false)
  })
})

// ── resolveAdminNotice ──────────────────────────────────────────────────────

describe('resolveAdminNotice', () => {
  it('shows nothing when the server is fine and the session has time left', () => {
    expect(resolveAdminNotice('none', 'ok')).toBe('none')
  })

  it('warns about the session only when nothing is wrong with the server', () => {
    expect(resolveAdminNotice('none', 'warning')).toBe('session-warning')
  })

  it.each(['outdated', 'unreachable'] as const)(
    'ranks the %s server notice above the session warning',
    (serverNotice) => {
      expect(resolveAdminNotice(serverNotice, 'warning')).toBe(serverNotice)
    }
  )

  it('ranks the session warning above the informational restart notice', () => {
    // `restarted` is sticky. If it outranked the countdown, dismissing it once
    // would keep the session bar hidden for the rest of the session.
    expect(resolveAdminNotice('restarted', 'warning')).toBe('session-warning')
  })

  it('still shows the restart notice when the session has time left', () => {
    expect(resolveAdminNotice('restarted', 'ok')).toBe('restarted')
  })

  it('leaves the critical phase to the dialog', () => {
    expect(resolveAdminNotice('none', 'critical')).toBe('none')
  })

  it.each(['none', 'outdated', 'restarted'] as const)(
    'ranks an expired session above the %s server notice',
    (serverNotice) => {
      expect(resolveAdminNotice(serverNotice, 'expired')).toBe(
        'session-expired'
      )
    }
  )

  it('ranks an unreachable server above an expired session', () => {
    // Signing in cannot work while the server is down.
    expect(resolveAdminNotice('unreachable', 'expired')).toBe('unreachable')
  })
})

// ── shouldShowSessionDialog ─────────────────────────────────────────────────

describe('shouldShowSessionDialog', () => {
  it('opens for the last couple of minutes and after the deadline', () => {
    expect(shouldShowSessionDialog('none', 'critical', false)).toBe(true)
    expect(shouldShowSessionDialog('none', 'expired', false)).toBe(true)
  })

  it('stays shut while there is time left', () => {
    expect(shouldShowSessionDialog('none', 'ok', false)).toBe(false)
    expect(shouldShowSessionDialog('none', 'warning', false)).toBe(false)
  })

  it('stays shut while the server is unreachable, when a refresh cannot work', () => {
    expect(shouldShowSessionDialog('unreachable', 'critical', false)).toBe(
      false
    )
    expect(shouldShowSessionDialog('unreachable', 'expired', false)).toBe(false)
  })

  it('still opens when the only problem is a stale bundle', () => {
    expect(shouldShowSessionDialog('outdated', 'critical', false)).toBe(true)
  })

  it('stays shut once the editor closed the expired dialog to copy their work', () => {
    expect(shouldShowSessionDialog('none', 'expired', true)).toBe(false)
  })

  it('ignores the dismissal outside the expired phase', () => {
    expect(shouldShowSessionDialog('none', 'critical', true)).toBe(true)
  })
})
