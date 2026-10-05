/**
 * The admin top-bar notice. Rendered above every authenticated page, directly
 * below Strapi's own UpsellBanner.
 *
 * It sits in flow at the top of the content column and docks to the bottom of
 * the viewport once scrolled away (see `useDockWhenScrolledAway` for why the
 * bottom). It is one element that changes position — not a second copy — so
 * screen readers hear one live region and keyboard users meet each button once.
 *
 * Laid out by hand rather than with the design-system `Alert`: that component
 * wraps title, body and action as one top-aligned row, which leaves a button
 * sitting below the text line it belongs to.
 */
import {
  Box,
  Button,
  Flex,
  IconButton,
  Typography
} from '@strapi/design-system'
import { CheckCircle, Cross, WarningCircle } from '@strapi/icons'
import * as React from 'react'

import type { AdminNotice } from '../../utils/adminNotice'
import { useDockWhenScrolledAway } from './useDockWhenScrolledAway'
import type { SessionCountdown } from './useSessionCountdown'
import { useSignInAgain } from './useSignInAgain'

type NoticeVariant = 'danger' | 'warning' | 'success'

interface NoticeCopy {
  title: string
  body: string
  variant: NoticeVariant
  /** Whether the editor may hide the notice. */
  isDismissible: boolean
}

/** Above Strapi's fixed page header (z-index 2); dialogs portal above this. */
const DOCKED_Z_INDEX = 3

const NOTICE_COPY: Record<Exclude<AdminNotice, 'none'>, NoticeCopy> = {
  outdated: {
    title: 'The CMS was updated',
    body: 'This page is running an older version of the admin. Reload before saving — saves and some screens will fail until you do.',
    variant: 'danger',
    isDismissible: true
  },
  unreachable: {
    title: 'Cannot reach the CMS',
    body: 'The server may be restarting. Do not save right now — your changes will fail. Keep this tab open; the notice clears when the server is back.',
    variant: 'danger',
    isDismissible: true
  },
  restarted: {
    title: 'The CMS server restarted',
    body: 'It is back up. If a save failed while it was down, try it again.',
    variant: 'warning',
    isDismissible: true
  },
  'session-warning': {
    title: 'Your session is about to expire',
    body: 'You will be signed out and any unsaved changes will be lost.',
    variant: 'warning',
    isDismissible: true
  },
  'session-expired': {
    title: 'Your session has expired',
    body: 'Saving will not work. Copy anything you have not saved, then sign in again.',
    variant: 'danger',
    // The editor already closed the dialog to get here; this bar is their only
    // remaining way to the login page.
    isDismissible: false
  }
}

interface NoticeBarProps {
  notice: AdminNotice
  session: SessionCountdown
}

export function NoticeBar({ notice, session }: NoticeBarProps) {
  const [dismissed, setDismissed] = React.useState<AdminNotice | null>(null)
  const slotRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)

  // A dismissal covers the notice that was on screen, not the next one: a
  // different problem is new information and has to be shown again.
  React.useEffect(() => {
    setDismissed((current) => (current === notice ? current : null))
  }, [notice])

  const isVisible = notice !== 'none' && dismissed !== notice
  const slot = useDockWhenScrolledAway(slotRef, barRef, isVisible)

  if (!isVisible) return null

  const copy = NOTICE_COPY[notice]
  const title =
    notice === 'session-warning'
      ? `${copy.title} (${session.label})`
      : copy.title
  const body =
    notice === 'session-warning' && session.refreshFailed
      ? 'Could not extend your session — the CMS may be unreachable. Try again in a moment.'
      : copy.body

  return (
    <div
      ref={slotRef}
      style={slot.isDocked ? { minHeight: slot.heightPx } : undefined}
    >
      <Box
        ref={barRef}
        padding={2}
        background={slot.isDocked ? undefined : 'neutral100'}
        style={
          slot.isDocked
            ? {
                position: 'fixed',
                bottom: 0,
                left: slot.leftPx,
                width: slot.widthPx,
                zIndex: DOCKED_Z_INDEX
              }
            : undefined
        }
      >
        <Flex
          alignItems="center"
          gap={4}
          wrap="wrap"
          hasRadius
          background={`${copy.variant}100`}
          borderColor={`${copy.variant}200`}
          shadow={slot.isDocked ? 'popupShadow' : 'filterShadow'}
          paddingTop={3}
          paddingBottom={3}
          paddingLeft={5}
          paddingRight={4}
        >
          <Flex alignItems="center" gap={3} flex="1 1 24rem">
            <NoticeIcon variant={copy.variant} />
            <Flex
              direction="column"
              alignItems="flex-start"
              gap={1}
              role={copy.variant === 'danger' ? 'alert' : 'status'}
            >
              <Typography fontWeight="bold" textColor="neutral800" tag="p">
                {title}
              </Typography>
              <Typography textColor="neutral800" tag="p">
                {body}
              </Typography>
            </Flex>
          </Flex>
          <Flex alignItems="center" gap={2} marginLeft="auto">
            <NoticeAction notice={notice} session={session} />
            {copy.isDismissible ? (
              <IconButton
                label="Dismiss this notice"
                variant="ghost"
                onClick={() => setDismissed(notice)}
              >
                <Cross />
              </IconButton>
            ) : null}
          </Flex>
        </Flex>
      </Box>
    </div>
  )
}

function NoticeIcon({ variant }: { variant: NoticeVariant }) {
  const Icon = variant === 'success' ? CheckCircle : WarningCircle
  return (
    <Icon
      aria-hidden
      focusable={false}
      width="2rem"
      height="2rem"
      fill={`${variant}700`}
      style={{ flexShrink: 0 }}
    />
  )
}

interface NoticeActionProps {
  notice: Exclude<AdminNotice, 'none'>
  session: SessionCountdown
}

function NoticeAction({ notice, session }: NoticeActionProps) {
  const signInAgain = useSignInAgain()

  switch (notice) {
    case 'session-warning':
      return (
        <Button
          variant="tertiary"
          loading={session.isRefreshing}
          onClick={() => {
            void session.staySignedIn()
          }}
        >
          Stay signed in
        </Button>
      )
    case 'session-expired':
      return (
        <Button variant="danger-light" onClick={signInAgain}>
          Sign in again
        </Button>
      )
    case 'outdated':
      return (
        <Button
          variant="tertiary"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload now
        </Button>
      )
    case 'unreachable':
    case 'restarted':
      return null
  }
}
