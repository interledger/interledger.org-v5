import { describe, expect, it } from 'vitest'
import { hrefWithPreservedSearch } from './grantee-search-result'

describe('hrefWithPreservedSearch', () => {
  const origin = 'https://interledger.org'

  it('returns the href unchanged when the query is empty', () => {
    expect(
      hrefWithPreservedSearch('/grant/grantee-directory/privacy', '', origin)
    ).toBe('/grant/grantee-directory/privacy')
  })

  it('appends ?q= to a same-origin directory href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024/education',
        'open payments',
        origin
      )
    ).toBe('/grant/grantee-directory/2024/education?q=open+payments')
  })

  it('leaves an external href unchanged', () => {
    const href = 'https://community.interledger.org/some-report'
    expect(hrefWithPreservedSearch(href, 'education', origin)).toBe(href)
  })

  it('preserves a hash on a same-origin href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/privacy#list',
        'education',
        origin
      )
    ).toBe('/grant/grantee-directory/privacy?q=education#list')
  })
})
