/**
 * Pathless layout route wrapping every authenticated admin route, so the notice
 * bar renders on every page while still sitting inside Strapi's providers
 * (theme, intl, redux, auth).
 *
 * The error boundary is not optional. This component is an ancestor of the
 * whole admin, so an unhandled throw in a notice would bubble to the root
 * route's errorElement and replace the entire CMS with an error page. It wraps
 * only the notices — never the Outlet — and renders nothing on failure: no
 * banner is a far better outcome than no CMS.
 */
import * as React from 'react'
import { Outlet } from 'react-router-dom'

import {
  resolveAdminNotice,
  shouldShowSessionDialog
} from '../../utils/adminNotice'
import { NoticeBar } from './NoticeBar'
import { SessionExpiryDialog } from './SessionExpiryDialog'
import { useServerStatus } from './useServerStatus'
import { useSessionCountdown } from './useSessionCountdown'

interface NoticeErrorBoundaryState {
  hasFailed: boolean
}

class NoticeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  NoticeErrorBoundaryState
> {
  state: NoticeErrorBoundaryState = { hasFailed: false }

  static getDerivedStateFromError(): NoticeErrorBoundaryState {
    return { hasFailed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[cms-notices] disabled after an error:', error)
  }

  render() {
    return this.state.hasFailed ? null : this.props.children
  }
}

function AdminNotices() {
  const { notice: serverNotice, clockOffsetMs } = useServerStatus()
  const session = useSessionCountdown(clockOffsetMs)

  return (
    <>
      <NoticeBar
        notice={resolveAdminNotice(serverNotice, session.phase)}
        session={session}
      />
      <SessionExpiryDialog
        open={shouldShowSessionDialog(serverNotice, session.phase)}
        session={session}
      />
    </>
  )
}

export function AdminNoticesLayout() {
  return (
    <>
      <NoticeErrorBoundary>
        <AdminNotices />
      </NoticeErrorBoundary>
      <Outlet />
    </>
  )
}
