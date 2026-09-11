import { describe, it, expect } from 'vitest'
import { matchesBlogSearch, filterBlogPosts } from './blogSearchFilters'

interface FakeEntry {
  locale: 'en' | 'es'
  searchText: string
}

function makeEntry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    locale: 'en',
    searchText: 'blog post about payments',
    ...overrides
  }
}

describe('matchesBlogSearch', () => {
  it('matches when the query is empty and the locale matches', () => {
    const entry = makeEntry()
    expect(matchesBlogSearch(entry, { lang: 'en' })).toBe(true)
  })

  it('rejects an entry in a different content language', () => {
    const entry = makeEntry({ locale: 'es' })
    expect(matchesBlogSearch(entry, { q: 'payments', lang: 'en' })).toBe(false)
  })

  it('matches a substring of searchText', () => {
    const entry = makeEntry()
    expect(matchesBlogSearch(entry, { q: 'payments', lang: 'en' })).toBe(true)
  })

  it('is case-insensitive on the query', () => {
    const entry = makeEntry()
    expect(matchesBlogSearch(entry, { q: 'PAYMENTS', lang: 'en' })).toBe(true)
  })

  it('is case-insensitive on searchText, regardless of its casing', () => {
    const entry = makeEntry({ searchText: 'Blog Post About Payments' })
    expect(matchesBlogSearch(entry, { q: 'payments', lang: 'en' })).toBe(true)
    expect(matchesBlogSearch(entry, { q: 'PAYMENTS', lang: 'en' })).toBe(true)
  })

  it('rejects when the query does not appear in searchText', () => {
    const entry = makeEntry()
    expect(matchesBlogSearch(entry, { q: 'grants', lang: 'en' })).toBe(false)
  })

  it('ignores leading/trailing whitespace in the query', () => {
    const entry = makeEntry()
    expect(matchesBlogSearch(entry, { q: '  payments  ', lang: 'en' })).toBe(
      true
    )
  })

  it('treats a whitespace-only query as empty', () => {
    const entry = makeEntry({ locale: 'es' })
    expect(matchesBlogSearch(entry, { q: '   ', lang: 'es' })).toBe(true)
  })
})

describe('filterBlogPosts', () => {
  it('returns an empty array when no entries match', () => {
    const entries = [makeEntry({ searchText: 'engineering update' })]
    expect(filterBlogPosts(entries, { q: 'grants', lang: 'en' })).toEqual([])
  })

  it('keeps only entries matching both locale and query', () => {
    const entries = [
      makeEntry({ locale: 'en', searchText: 'grants program news' }),
      makeEntry({ locale: 'es', searchText: 'programa de subvenciones' }),
      makeEntry({ locale: 'en', searchText: 'engineering update' })
    ]

    const result = filterBlogPosts(entries, { q: 'grants', lang: 'en' })

    expect(result).toEqual([
      makeEntry({ locale: 'en', searchText: 'grants program news' })
    ])
  })
})
