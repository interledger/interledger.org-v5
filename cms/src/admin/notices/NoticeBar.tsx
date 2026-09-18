/**
 * The admin top-bar notice. Rendered above every authenticated page, directly
 * below Strapi's own UpsellBanner.
 *
 * Deliberately not sticky, matching that banner: Strapi's SubNav is already
 * `position: sticky; top: 0` with no z-index inside the same scroll container,
 * so a sticky bar would cover the content-manager and settings sub-navigation —
 * and below the `large` breakpoint that container doesn't scroll at all, so
 * sticky wouldn't resolve anyway.
 */
import { Alert, Box, Button, Flex } from '@strapi/design-system'
import * as React from 'react'

import type { AdminNotice } from '../../utils/adminNotice'
import type { SessionCountdown } from './useSessionCountdown'

type AlertVariant = 'danger' | 'warning' | 'success'

interface NoticeCopy {
  title: string
  body: string
  variant: AlertVariant
}

const NOTICE_COPY: Record<Exclude<AdminNotice, 'none'>, NoticeCopy> = {
  outdated: {
    title: 'The CMS was updated',
    body: 'This page is running an older version of the admin. Reload before saving — saves and some screens will fail until you do.',
    variant: 'danger'
  },
  unreachable: {
    title: 'Cannot reach the CMS',
    body: 'The server may be restarting. Do not save right now — your changes will fail. Keep this tab open; the notice clears when the server is back.',
    variant: 'danger'
  },
  restarted: {
    title: 'The CMS server restarted',
    body: 'It is back up. If a save failed while it was down, try it again.',
    variant: 'warning'
  },
  'session-warning': {
    title: 'Your session is about to expire',
    body: 'You will be signed out and any unsaved changes will be lost.',
    variant: 'warning'
  }
}

interface NoticeBarProps {
  notice: AdminNotice
  session: SessionCountdown
}

export function NoticeBar({ notice, session }: NoticeBarProps) {
  const [dismissed, setDismissed] = React.useState<AdminNotice | null>(null)

  // A dismissal covers the notice that was on screen, not the next one: a
  // different problem is new information and has to be shown again.
  React.useEffect(() => {
    setDismissed((current) => (current === notice ? current : null))
  }, [notice])

  if (notice === 'none' || dismissed === notice) return null

  const copy = NOTICE_COPY[notice]
  const isSessionWarning = notice === 'session-warning'

  return (
    <Box padding={2} background="neutral100" width="100%">
      <Alert
        variant={copy.variant}
        title={
          isSessionWarning ? `${copy.title} (${session.label})` : copy.title
        }
        closeLabel="Dismiss this notice"
        onClose={() => setDismissed(notice)}
        action={
          <Flex gap={2}>
            {isSessionWarning ? (
              <Button
                variant="tertiary"
                loading={session.isRefreshing}
                onClick={() => {
                  void session.staySignedIn()
                }}
              >
                Stay signed in
              </Button>
            ) : null}
            {notice === 'outdated' ? (
              <Button
                variant="tertiary"
                onClick={() => {
                  window.location.reload()
                }}
              >
                Reload now
              </Button>
            ) : null}
          </Flex>
        }
      >
        {isSessionWarning && session.refreshFailed
          ? 'Could not extend your session — the CMS may be unreachable. Try again in a moment.'
          : copy.body}
      </Alert>
    </Box>
  )
}
