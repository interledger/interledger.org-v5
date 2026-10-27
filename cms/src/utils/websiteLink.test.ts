import { describe, expect, it } from 'vitest'
import { resolveWebsiteLink } from './websiteLink'

// Literal strings throughout, not the module's own constants: a typo in the
// map, or a variable name that drifts from the one the rebuild workflow sets,
// must fail here.
const LOCAL_LINK = {
  url: 'http://localhost:1103/',
  label: 'Local website'
}

describe('resolveWebsiteLink', () => {
  it.each([
    ['local', LOCAL_LINK],
    [
      'staging',
      { url: 'https://staging.interledger.org/', label: 'Staging website' }
    ],
    [
      'playground',
      {
        url: 'https://playground--interledger-org-v5.netlify.app/',
        label: 'Playground website'
      }
    ]
  ])('links the %s admin to its own website', (name, expected) => {
    expect(resolveWebsiteLink({ STRAPI_ADMIN_ENVIRONMENT_NAME: name })).toEqual(
      expected
    )
  })

  it('links to the local website when there is no env at all', () => {
    // The admin passes `undefined` when `process` is not defined.
    expect(resolveWebsiteLink(undefined)).toEqual(LOCAL_LINK)
  })

  it('links to the local website when the name is not set', () => {
    // Every build outside the VMs: `pnpm develop`, a local build, CI.
    expect(resolveWebsiteLink({})).toEqual(LOCAL_LINK)
  })

  it('links to the local website for an unknown name', () => {
    // Matching is case-sensitive, so a mistyped `Local` is unknown too.
    expect(
      resolveWebsiteLink({ STRAPI_ADMIN_ENVIRONMENT_NAME: 'Local' })
    ).toEqual(LOCAL_LINK)
  })
})
