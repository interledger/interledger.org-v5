/**
 * Sends an editor whose session has expired to the login page. Shared by the
 * expiry dialog and the expired-session bar that replaces it once closed.
 */
import { useAuth } from '@strapi/admin/strapi-admin'
import * as React from 'react'

import { tryCatchAsync } from '../../utils/tryCatch'

const LOGIN_PATH = '/admin/auth/login'

export function useSignInAgain(): () => void {
  const logout = useAuth('useSignInAgain', (state) => state.logout)

  return React.useCallback(() => {
    // Sign out on our terms rather than waiting for the next background 401.
    //
    // Neither caller offers another way to the login page, so if logout ever
    // failed to navigate the editor would be stranded. Strapi's logout awaits
    // an RTK Query trigger, which resolves rather than throws on a 401, so it
    // always clears local state today — the fallback is here because being
    // wrong about that would strand someone.
    void tryCatchAsync(() => logout()).then((result) => {
      if (result instanceof Error) {
        window.location.href = LOGIN_PATH
      }
    })
  }, [logout])
}
