import { describe, expect, it } from 'vitest'
import {
  filterGrantees,
  getGranteeFilterUrl,
  matchesGranteeFilters
} from './granteeFilters'

describe('matchesGranteeFilters', () => {
  const grantee = {
    year: '2024',
    tags: ['Privacy'],
    searchText: 'people’s clearing house privacy germany'
  }

  it('matches when no filters are set', () => {
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '',
        tag: ''
      })
    ).toBe(true)
  })

  it('filters by year and thematic tag', () => {
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '2024',
        tag: 'privacy'
      })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '2020',
        tag: ''
      })
    ).toBe(false)
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '',
        tag: 'education'
      })
    ).toBe(false)
  })
})

describe('filterGrantees', () => {
  // Structural fixtures, not full `Grantee` records: filterGrantees is generic
  // over anything carrying year/tags/searchText, which is what lets the
  // client-side search index reuse it.
  const entries = [
    { year: '2024', tags: ['Privacy'], searchText: 'clearing house' },
    { year: '2025', tags: ['Education'], searchText: 'campus lab' }
  ]

  it('returns only records matching the year filter', () => {
    expect(filterGrantees(entries, { q: '', year: '2025', tag: '' })).toEqual([
      entries[1]
    ])
  })

  it('returns only records matching the tag filter', () => {
    expect(
      filterGrantees(entries, { q: '', year: '', tag: 'privacy' })
    ).toEqual([entries[0]])
  })

  it('returns every record when no filter is set', () => {
    expect(filterGrantees(entries, { q: '', year: '', tag: '' })).toEqual(
      entries
    )
  })
})

describe('getGranteeFilterUrl', () => {
  const directory = '/grant/grantee-directory'

  it('returns the directory path when nothing is selected', () => {
    expect(getGranteeFilterUrl(directory)).toBe(directory)
  })

  it('appends the year value', () => {
    expect(getGranteeFilterUrl(directory, '2024')).toBe(
      '/grant/grantee-directory/2024'
    )
  })

  it('puts every tag under /tag/, including reserved slugs', () => {
    expect(getGranteeFilterUrl(directory, undefined, 'privacy')).toBe(
      '/grant/grantee-directory/tag/privacy'
    )
    expect(getGranteeFilterUrl(directory, undefined, 'all')).toBe(
      '/grant/grantee-directory/tag/all'
    )
    expect(getGranteeFilterUrl(directory, undefined, '2024')).toBe(
      '/grant/grantee-directory/tag/2024'
    )
    expect(getGranteeFilterUrl(directory, undefined, '2')).toBe(
      '/grant/grantee-directory/tag/2'
    )
  })

  it('nests year and tag as /<year>/tag/<slug>', () => {
    expect(getGranteeFilterUrl(directory, '2024', 'privacy')).toBe(
      '/grant/grantee-directory/2024/tag/privacy'
    )
    expect(getGranteeFilterUrl(directory, '2024', 'all')).toBe(
      '/grant/grantee-directory/2024/tag/all'
    )
    expect(getGranteeFilterUrl(directory, '2024', '2')).toBe(
      '/grant/grantee-directory/2024/tag/2'
    )
  })
})
