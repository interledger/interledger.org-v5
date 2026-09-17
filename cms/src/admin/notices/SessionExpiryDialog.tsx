/**
 * Last-chance prompt before an idle session dies, and the sign-in prompt once
 * it has.
 *
 * A modal rather than a bar because the failure it prevents is silent: Strapi
 * gives no warning, it simply 401s the next save and redirects to the login
 * page with the editor's unsaved work still in the form.
 */
import { Button, Dialog } from '@strapi/design-system'
import { useAuth } from '@strapi/admin/strapi-admin'

import { tryCatchAsync } from '../../utils/tryCatch'
import type { SessionCountdown } from './useSessionCountdown'

interface SessionExpiryDialogProps {
  open: boolean
  session: SessionCountdown
}

export function SessionExpiryDialog({
  open,
  session
}: SessionExpiryDialogProps) {
  const logout = useAuth('SessionExpiryDialog', (state) => state.logout)
  const hasExpired = session.phase === 'expired'

  return (
    <Dialog.Root open={open}>
      <Dialog.Content>
        <Dialog.Header>
          {hasExpired ? 'Your session has expired' : 'Still there?'}
        </Dialog.Header>
        <Dialog.Body>
          {hasExpired
            ? 'Sign in again to keep working. Copy anything you have not saved before you do — it will not survive the sign-in.'
            : `Your session expires in ${session.label}. Stay signed in to keep your unsaved changes.`}
        </Dialog.Body>
        <Dialog.Footer>
          {hasExpired ? (
            <Button
              fullWidth
              variant="danger-light"
              onClick={() => {
                // Sign out on our terms rather than waiting for the next
                // background 401 to yank this dialog away mid-read.
                //
                // This dialog is modal and has no cancel button, so if logout
                // ever failed to navigate the editor would be trapped with no
                // way to reach the login page. Strapi's logout awaits an RTK
                // Query trigger, which resolves rather than throws on a 401, so
                // it always clears local state today — the fallback is here
                // because being wrong about that would strand someone.
                void tryCatchAsync(() => logout()).then((result) => {
                  if (result instanceof Error) {
                    window.location.href = '/admin/auth/login'
                  }
                })
              }}
            >
              Sign in again
            </Button>
          ) : (
            <Button
              fullWidth
              loading={session.isRefreshing}
              onClick={() => {
                void session.staySignedIn()
              }}
            >
              {session.refreshFailed ? 'Try again' : 'Stay signed in'}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
