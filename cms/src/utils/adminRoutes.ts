/**
 * Guard for wrapping the admin route tree in the notices layout.
 *
 * Strapi v5 has no global injection zone, so the only supported way to render
 * something on every authenticated page is `app.router.addRoute(reducer)` with
 * a pathless layout route. That is safe, but it has one sharp edge worth
 * encoding and testing rather than trusting:
 *
 * `Router.createSettingsLink` locates the settings route with
 * `findIndex(r => r.path === 'settings/*')` and then tests `if (!settingsIndex)`.
 * Once the routes are nested under a wrapper, findIndex returns -1, `!(-1)` is
 * false, and it dereferences `routes[-1]` — white-screening the whole admin.
 *
 * Every plugin registers its settings links before our bootstrap runs, so the
 * wrap is safe today. These checks make it fail open rather than fail fatally
 * if that ever stops being true.
 */

export const NOTICES_ROUTE_ID = 'cms-admin-notices'

const SETTINGS_ROUTE_PATH = 'settings/*'

/** The bits of a react-router route object this decision looks at. */
export interface AdminRouteShape {
  id?: string
  path?: string
}

export type AdminRouteWrapDecision =
  | 'wrap'
  | 'already-wrapped'
  | 'empty'
  | 'unrecognized-route-tree'

export function decideAdminRouteWrap(
  routes: ReadonlyArray<AdminRouteShape>
): AdminRouteWrapDecision {
  if (routes.length === 0) return 'empty'

  // Idempotent under HMR, which re-runs register/bootstrap against live routes.
  if (routes.length === 1 && routes[0]?.id === NOTICES_ROUTE_ID) {
    return 'already-wrapped'
  }

  // If the settings route isn't where createSettingsLink expects it, something
  // else already restructured the tree — a banner isn't worth the risk.
  if (!routes.some((route) => route.path === SETTINGS_ROUTE_PATH)) {
    return 'unrecognized-route-tree'
  }

  return 'wrap'
}
