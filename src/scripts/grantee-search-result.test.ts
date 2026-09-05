import { describe, expect, it, vi, afterEach } from 'vitest'
import { withSearchQuery } from './grantee-search-result'

describe('withSearchQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the href unchanged when the query is empty', () => {
    expect(withSearchQuery('/grant/grantee-directory/privacy', '')).toBe(
      '/grant/grantee-directory/privacy'
    )
  })

  it('appends ?q= to a directory filter href', () => {
    vi.stubGlobal('window', { location: { origin: 'https://interledger.org' } })
    expect(
      withSearchQuery(
        '/grant/grantee-directory/2024/education',
        'open payments'
      )
    ).toBe('/grant/grantee-directory/2024/education?q=open+payments')
  })
})
