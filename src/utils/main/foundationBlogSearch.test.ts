import { describe, expect, it } from 'vitest'
import { searchFoundationBlog } from './foundationBlogSearch'
import type { SearchIndexEntry } from '../../types/foundationBlogSearch'

const makeEntry = (
  overrides: Partial<SearchIndexEntry> = {}
): SearchIndexEntry => ({
  title: 'Test Post',
  description: 'A description about payments',
  pathSlug: 'test-post',
  date: '2024-01-01T00:00:00.000Z',
  tags: ['Announcements'],
  excerpt: 'This is the body content of the blog post.',
  thumbnailImage: undefined,
  thumbnailImageAlt: undefined,
  ...overrides,
})

describe('searchFoundationBlog', () => {
  it('returns empty array for empty query', () => {
    const index = [makeEntry()]
    expect(searchFoundationBlog(index, '')).toEqual([])
    expect(searchFoundationBlog(index, '  ')).toEqual([])
  })

  it('matches on title', () => {
    const index = [
      makeEntry({ title: 'Open Payments Launch' }),
      makeEntry({ title: 'Interledger Update', pathSlug: 'interledger-update' }),
    ]
    const results = searchFoundationBlog(index, 'open payments')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Open Payments Launch')
  })

  it('matches on description', () => {
    const index = [
      makeEntry({ description: 'A post about financial inclusion' }),
      makeEntry({ pathSlug: 'other' }),
    ]
    expect(searchFoundationBlog(index, 'financial inclusion')).toHaveLength(1)
  })

  it('matches on excerpt', () => {
    const index = [
      makeEntry({ excerpt: 'Detailed discussion of web monetization' }),
      makeEntry({ pathSlug: 'other' }),
    ]
    expect(searchFoundationBlog(index, 'web monetization')).toHaveLength(1)
  })

  it('matches on tags', () => {
    const index = [
      makeEntry({ tags: ['Grants & Grantee Insights'] }),
      makeEntry({ tags: ['Announcements'], pathSlug: 'other' }),
    ]
    expect(searchFoundationBlog(index, 'grants')).toHaveLength(1)
  })

  it('requires all terms to match', () => {
    const index = [
      makeEntry({ title: 'Open Payments' }),
      makeEntry({ title: 'Payments News', pathSlug: 'payments-news' }),
    ]
    expect(searchFoundationBlog(index, 'open payments')).toHaveLength(1)
  })

  it('is case-insensitive', () => {
    const index = [makeEntry({ title: 'Open Payments' })]
    expect(searchFoundationBlog(index, 'OPEN PAYMENTS')).toHaveLength(1)
    expect(searchFoundationBlog(index, 'open payments')).toHaveLength(1)
  })

  it('returns all matching entries', () => {
    const index = [
      makeEntry({ title: 'Interledger Update' }),
      makeEntry({ title: 'Interledger Launch', pathSlug: 'interledger-launch' }),
      makeEntry({ title: 'Other Post', pathSlug: 'other-post' }),
    ]
    expect(searchFoundationBlog(index, 'interledger')).toHaveLength(2)
  })

  it('returns empty array when nothing matches', () => {
    const index = [makeEntry()]
    expect(searchFoundationBlog(index, 'xyz-no-match')).toEqual([])
  })

  it('matches a term that spans title and description (both must be in haystack)', () => {
    const entry = makeEntry({
      title: 'Digital Wallets',
      description: 'An article about inclusion',
    })
    expect(searchFoundationBlog([entry], 'digital inclusion')).toHaveLength(1)
  })
})
