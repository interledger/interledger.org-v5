/**
 * Last-chance prompt before an idle session dies, and the sign-in prompt once
 * it has.
 *
 * A modal rather than a bar because the failure it prevents is silent: Strapi
 * gives no warning, it simply 401s the next save and redirects to the login
 * page with the editor's unsaved work still in the form.
 */
import { Button, Dialog, Flex } from '@strapi/design-system'

import type { SessionCountdown } from './useSessionCountdown'
import { useSignInAgain } from './useSignInAgain'

interface SessionExpiryDialogProps {
  open: boolean
  session: SessionCountdown
  /** Closes the expired dialog so the editor can copy unsaved work. */
  onDismissExpired: () => void
}

export function SessionExpiryDialog({
  open,
  session,
  onDismissExpired
}: SessionExpiryDialogProps) {
  const signInAgain = useSignInAgain()
  const hasExpired = session.phase === 'expired'

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        // Escape closes only the expired dialog, like its "copy" button; the
        // critical one has nothing to gain from being closed.
        if (!isOpen && hasExpired) onDismissExpired()
      }}
    >
      <Dialog.Content>
        <Dialog.Header>
          {hasExpired ? 'Your session has expired' : 'Still there?'}
        </Dialog.Header>
        <Dialog.Body>
          {hasExpired
            ? 'Sign in again to keep working. Anything you have not saved will not survive the sign-in — close this to copy it out of the form first.'
            : `Your session expires in ${session.label}. Stay signed in to keep your unsaved changes.`}
        </Dialog.Body>
        <Dialog.Footer>
          {hasExpired ? (
            <Flex gap={2} width="100%">
              <Button fullWidth variant="tertiary" onClick={onDismissExpired}>
                Copy my changes first
              </Button>
              <Button fullWidth variant="danger-light" onClick={signInAgain}>
                Sign in again
              </Button>
            </Flex>
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
