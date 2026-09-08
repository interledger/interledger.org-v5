import { describe, expect, it } from 'vitest'
import { matchesGranteeFilters } from './granteeFilters'

const base = {
  year: '2024',
  tags: ['Privacy'],
  searchText: 'people’s clearing house privacy germany'
}

describe('matchesGranteeFilters', () => {
  it('matches a query against mixed-case searchText', () => {
    const grantee = { ...base, searchText: 'People’s Clearing House PRIVACY' }
    expect(
      matchesGranteeFilters(grantee, { q: 'clearing', year: '', tag: '' })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, { q: 'CLEARING', year: '', tag: '' })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, { q: 'education', year: '', tag: '' })
    ).toBe(false)
  })

  it('treats a missing or blank q as no search filter', () => {
    expect(matchesGranteeFilters(base, { year: '', tag: '' })).toBe(true)
    expect(matchesGranteeFilters(base, { q: '   ', year: '', tag: '' })).toBe(
      true
    )
  })
})
