import { describe, expect, it } from 'vitest'
import { resolveAdminNotice, shouldShowSessionDialog } from './adminNotice'

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

  it('leaves the critical and expired phases to the dialog', () => {
    expect(resolveAdminNotice('none', 'critical')).toBe('none')
    expect(resolveAdminNotice('none', 'expired')).toBe('none')
  })
})

// ── shouldShowSessionDialog ─────────────────────────────────────────────────

describe('shouldShowSessionDialog', () => {
  it('opens for the last couple of minutes and after the deadline', () => {
    expect(shouldShowSessionDialog('none', 'critical')).toBe(true)
    expect(shouldShowSessionDialog('none', 'expired')).toBe(true)
  })

  it('stays shut while there is time left', () => {
    expect(shouldShowSessionDialog('none', 'ok')).toBe(false)
    expect(shouldShowSessionDialog('none', 'warning')).toBe(false)
  })

  it('stays shut while the server is unreachable, when a refresh cannot work', () => {
    expect(shouldShowSessionDialog('unreachable', 'critical')).toBe(false)
    expect(shouldShowSessionDialog('unreachable', 'expired')).toBe(false)
  })

  it('still opens when the only problem is a stale bundle', () => {
    expect(shouldShowSessionDialog('outdated', 'critical')).toBe(true)
  })
})
