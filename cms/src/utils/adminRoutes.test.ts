import { describe, expect, it } from 'vitest'
import { NOTICES_ROUTE_ID, decideAdminRouteWrap } from './adminRoutes'

// Shape of Strapi's authenticated route list at customBootstrap time: the
// initial routes plus one per plugin menu link.
const STRAPI_ROUTES = [
  { index: true },
  { path: 'me' },
  { path: 'settings/*' },
  { path: 'content-manager/*' },
  { path: 'plugins/upload/*' }
]

describe('decideAdminRouteWrap', () => {
  it('wraps a normal Strapi route tree', () => {
    expect(decideAdminRouteWrap(STRAPI_ROUTES)).toBe('wrap')
  })

  it('does nothing when the routes are already wrapped', () => {
    expect(decideAdminRouteWrap([{ id: NOTICES_ROUTE_ID }])).toBe(
      'already-wrapped'
    )
  })

  it('does nothing when there are no routes at all', () => {
    expect(decideAdminRouteWrap([])).toBe('empty')
  })

  it('refuses to wrap when the settings route is not at the top level', () => {
    // createSettingsLink would dereference routes[-1] and white-screen the
    // admin; failing open costs a banner, failing closed costs the CMS.
    const alreadyRestructured = STRAPI_ROUTES.filter(
      (route) => route.path !== 'settings/*'
    )

    expect(decideAdminRouteWrap(alreadyRestructured)).toBe(
      'unrecognized-route-tree'
    )
  })

  it('does not mistake a nested settings route for a top-level one', () => {
    expect(
      decideAdminRouteWrap([{ id: 'something-else' }, { path: 'me' }])
    ).toBe('unrecognized-route-tree')
  })
})
