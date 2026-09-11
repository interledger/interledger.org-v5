import { describe, expect, it } from 'vitest'
import {
  hrefFromOriginal,
  hrefWithPreservedSearch
} from './grantee-search-result'

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

  it('keeps an existing q when the query is empty', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024?q=education',
        '',
        origin
      )
    ).toBe('/grant/grantee-directory/2024?q=education')
  })
})

describe('hrefFromOriginal', () => {
  const origin = 'https://interledger.org'
  const original = '/grant/grantee-directory/2024'

  it('appends q from the original href, then restores it when the query is cleared', () => {
    expect(hrefFromOriginal(original, 'education', origin)).toBe(
      '/grant/grantee-directory/2024?q=education'
    )
    expect(hrefFromOriginal(original, '', origin)).toBe(original)
    expect(hrefFromOriginal(original, '   ', origin)).toBe(original)
  })

  it('replaces a previous query instead of stacking on a mutated href', () => {
    expect(hrefFromOriginal(original, 'open payments', origin)).toBe(
      '/grant/grantee-directory/2024?q=open+payments'
    )
  })
})
