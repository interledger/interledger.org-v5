import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStrapiClient } from './strapiClient'

/** Captures the URL of each request and answers with an empty result set. */
function stubFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: [] })
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The query string the client asked for, decoded once for readable asserts. */
function requestedQuery(fetchMock: ReturnType<typeof stubFetch>): string {
  return new URL(fetchMock.mock.calls[0]![0] as unknown as string).search
}

let fetchMock: ReturnType<typeof stubFetch>

beforeEach(() => {
  fetchMock = stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Values of the `filters[pathSlug][$in][n]` params, in order. */
function pathSlugFilter(params: URLSearchParams): string[] {
  return [...params.entries()]
    .filter(([key]) => key.startsWith('filters[pathSlug][$in]'))
    .map(([, value]) => value)
}

function slugForms(bare: string): string[] {
  return [bare, `/${bare}/`]
}

describe('findByPathSlug', () => {
  const client = () =>
    createStrapiClient({ baseUrl: 'http://strapi.test', token: 't' })

  it('filters on pathSlug and locale', async () => {
    await client().findByPathSlug('faqs', 'faq', 'en')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('faq'))
    expect(params.get('locale')).toBe('en')
    expect(params.has('filters[section][$eq]')).toBe(false)
  })

  it('adds the section filter for a cross-section content type', async () => {
    await client().findByPathSlug('faqs', 'faq', 'en', 'hackathon')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('faq'))
    expect(params.get('filters[section][$eq]')).toBe('hackathon')
  })

  // Stored slugs move from `faq` to `/faq/` (INTORG-1254). Until every row has
  // moved, the lookup must find either form, whichever form it is given.
  it('matches the bare and the slashed form of the slug', async () => {
    await client().findByPathSlug('faqs', '/faq/', 'en')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('faq'))
    expect(params.has('filters[pathSlug][$eq]')).toBe(false)
  })

  it('omits the section filter when none is given', async () => {
    await client().findByPathSlug('faqs', 'faq', 'en', null)

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(params.has('filters[section][$eq]')).toBe(false)
  })

  // A nested slug is the common case (grant/grantmaking-faq). It must survive
  // encoding and still arrive as the same value.
  it('keeps a nested pathSlug intact', async () => {
    await client().findByPathSlug('faqs', 'grant/grantmaking-faq', 'en')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('grant/grantmaking-faq'))
  })

  // Nothing restricts the characters in a pathSlug beyond trimming slashes, so
  // a raw `&` would split the query string and a raw `#` would truncate it,
  // turning a lookup for one entry into a lookup for something else entirely.
  it('encodes a pathSlug that would otherwise break the query string', async () => {
    await client().findByPathSlug('faqs', 'faq&locale=es', 'en')

    const query = requestedQuery(fetchMock)
    expect(query).toContain('faq%26locale%3Des')

    const params = new URLSearchParams(query)
    expect(pathSlugFilter(params)).toEqual(slugForms('faq&locale=es'))
    expect(params.get('locale')).toBe('en')
  })

  it('encodes a pathSlug containing a fragment marker or a space', async () => {
    await client().findByPathSlug('faqs', 'a b#c', 'en')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('a b#c'))
  })
})

describe('findAllByPathSlug', () => {
  const client = () =>
    createStrapiClient({ baseUrl: 'http://strapi.test', token: 't' })

  it('never filters by section, so every section shows up', async () => {
    await client().findAllByPathSlug('profile-pages', 'speakers/jane-doe', 'en')

    const params = new URLSearchParams(requestedQuery(fetchMock))
    expect(pathSlugFilter(params)).toEqual(slugForms('speakers/jane-doe'))
    expect(params.has('filters[section][$eq]')).toBe(false)
  })

  it('returns every match so a caller can spot an ambiguous slug', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [
              { documentId: 'a', pathSlug: 'faq', section: 'foundation' },
              { documentId: 'b', pathSlug: 'faq', section: 'hackathon' }
            ]
          })
      }))
    )

    const result = await client().findAllByPathSlug('faqs', 'faq', 'en')

    expect(Array.isArray(result) && result).toHaveLength(2)
  })

  it('returns an empty array when nothing matches', async () => {
    const result = await client().findAllByPathSlug('faqs', 'ghost', 'en')

    expect(result).toEqual([])
  })
})
