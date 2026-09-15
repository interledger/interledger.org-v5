import { describe, it, expect } from 'vitest'
import { matchesBlogSearch, filterBlogPosts } from './blogSearchFilters'

interface FakeEntry {
  locale: 'en' | 'es'
  categories: string[]
  searchText: string
}

function makeEntry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    locale: 'en',
    categories: ['Engineering'],
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

  it('matches accented content from an unaccented query and back', () => {
    // ES content is full of accents; folding both sides keeps `politica` and
    // `política` interchangeable either way round.
    const entry = makeEntry({
      locale: 'es',
      searchText: 'política y regulación de pagos'
    })

    expect(matchesBlogSearch(entry, { q: 'politica', lang: 'es' })).toBe(true)
    expect(matchesBlogSearch(entry, { q: 'política', lang: 'es' })).toBe(true)
    expect(matchesBlogSearch(entry, { q: 'REGULACION', lang: 'es' })).toBe(true)
  })

  it('narrows to the selected category when one is set', () => {
    const entry = makeEntry({ categories: ['Engineering', 'News'] })

    expect(
      matchesBlogSearch(entry, { q: 'payments', lang: 'en', category: 'News' })
    ).toBe(true)
    expect(
      matchesBlogSearch(entry, {
        q: 'payments',
        lang: 'en',
        category: 'Grantmaking'
      })
    ).toBe(false)
  })

  it('does not narrow by category when none is selected', () => {
    const entry = makeEntry({ categories: ['Engineering'] })

    expect(matchesBlogSearch(entry, { q: 'payments', lang: 'en' })).toBe(true)
    expect(
      matchesBlogSearch(entry, { q: 'payments', lang: 'en', category: '' })
    ).toBe(true)
  })

  it('rejects an entry with no categories when a category is selected', () => {
    const entry = makeEntry({ categories: [] })

    expect(matchesBlogSearch(entry, { lang: 'en', category: 'News' })).toBe(
      false
    )
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

  it('applies language, category and query together', () => {
    const entries = [
      makeEntry({ categories: ['News'], searchText: 'grants program news' }),
      makeEntry({
        categories: ['Grantmaking'],
        searchText: 'grants program update'
      }),
      makeEntry({ categories: ['News'], searchText: 'engineering update' })
    ]

    const result = filterBlogPosts(entries, {
      q: 'grants',
      lang: 'en',
      category: 'News'
    })

    expect(result).toEqual([
      makeEntry({ categories: ['News'], searchText: 'grants program news' })
    ])
  })
})
