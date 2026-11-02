import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import type { BlogSearchEntry } from '@/utils/main/blogSearch'
import type { SearchResultContext } from './blog-search-result'

// Pinned to a negative-offset zone before importing the module under test:
// CI runs in UTC, where a UTC-pinned formatter and a zone-naive one agree, so
// the regression this guards against is invisible unless the process sits west
// of Greenwich. Vitest isolates test files, and the original is restored below.
const originalTz = process.env.TZ
process.env.TZ = 'America/New_York'

const { formatSearchResultDate, searchResultBylineModel } =
  await import('./blog-search-result')

afterAll(() => {
  if (originalTz === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTz
  }
})

const SEARCH_RESULT_TEMPLATE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../components/blog/BlogSearchResultTemplate.astro'
)

/** Slots `createSearchResultRow` requires via `requireElement`. */
const REQUIRED_ROW_ATTRS = [
  'data-blog-search-link',
  'data-blog-search-snippet',
  'data-blog-search-categories',
  'data-blog-search-date',
  'data-blog-search-reading-time',
  'data-blog-search-author',
  'data-blog-search-author-avatar',
  'data-blog-search-author-fallback',
  'data-blog-search-author-name',
  'data-blog-search-thumbnail-wrap',
  'data-blog-search-thumbnail'
] as const

/** Slots `applyByline` looks up inside the author link, not the row. */
const AUTHOR_LINK_SLOTS = [
  'data-blog-search-author-avatar',
  'data-blog-search-author-fallback',
  'data-blog-search-author-name'
] as const

const CONTEXT: SearchResultContext = {
  pathname: '/blog/',
  lang: 'en',
  categoryLabels: {},
  readingTimeLabel: '{readingTime} min read',
  authorProfileLabel: "{author}'s profile (opens in a new tab)"
}

const SABINE = {
  name: 'Sabine Schaller',
  href: 'https://www.linkedin.com/in/sabine/',
  avatarSrc: '/img/foundation-blog/authors/sabine.jpg'
}

function sampleEntry(
  overrides: Partial<BlogSearchEntry> = {}
): BlogSearchEntry {
  return {
    id: 'post',
    title: 'Post',
    descriptionSnippet: 'Snippet',
    categories: [],
    date: '2026-09-16T00:00:00.000Z',
    postPath: '/blog/post/',
    thumbnail: null,
    author: SABINE,
    readingTime: 3,
    locale: 'en',
    searchText: 'post',
    ...overrides
  }
}

describe('formatSearchResultDate', () => {
  it('keeps the authored day west of Greenwich', () => {
    // Frontmatter dates are date-only, so the index ships them as UTC midnight.
    // Formatted in the viewer's zone this would read "Sep 15, 2026" — a day
    // earlier than the byline the build renders for the same post.
    const date = new Date('2026-09-16T00:00:00.000Z')

    expect(formatSearchResultDate(date, 'en')).toBe('Sep 16, 2026')
  })

  it('keeps the authored day in Spanish too', () => {
    const date = new Date('2026-09-16T00:00:00.000Z')

    expect(formatSearchResultDate(date, 'es')).toBe('16 sept 2026')
  })

  it('does not roll a new year back into the previous one', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')

    expect(formatSearchResultDate(date, 'en')).toBe('Jan 1, 2026')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatSearchResultDate(new Date('nonsense'), 'en')).toBe('')
  })
})

/**
 * `attr` as a whole attribute name. A plain substring check passes
 * `data-blog-search-author` on `data-blog-search-author-name` alone.
 */
function wholeAttribute(attr: string): RegExp {
  return new RegExp(`${attr}(?=[\\s=>/])`)
}

describe('BlogSearchResultTemplate', () => {
  const source = readFileSync(SEARCH_RESULT_TEMPLATE_PATH, 'utf8')

  it('keeps every populate-script slot', () => {
    expect(source).toContain('id="blog-search-result-template"')
    expect(source).toContain('data-blog-search-category-template')
    for (const attr of REQUIRED_ROW_ATTRS) {
      expect(source, attr).toMatch(wholeAttribute(attr))
    }
  })

  it('keeps the author slots inside the author link', () => {
    // applyByline looks these up inside the link, so one moved outside it
    // throws for every row and breaks the whole search.
    const start = wholeAttribute('data-blog-search-author').exec(source)?.index
    expect(start).toBeDefined()
    const end = source.indexOf('</a>', start)
    expect(end).toBeGreaterThan(start ?? 0)
    const authorLink = source.slice(start, end)
    for (const attr of AUTHOR_LINK_SLOTS) {
      expect(authorLink, attr).toMatch(wholeAttribute(attr))
    }
  })
})

describe('searchResultBylineModel', () => {
  it('links an author who has a profile, as BlogCardByline does', () => {
    const model = searchResultBylineModel(sampleEntry(), CONTEXT)

    expect(model.author?.name).toBe('Sabine Schaller')
    expect(model.author?.avatarSrc).toBe(
      '/img/foundation-blog/authors/sabine.jpg'
    )
    expect(model.author?.link?.href).toBe('https://www.linkedin.com/in/sabine/')
    expect(model.author?.link?.ariaLabel).toBe(
      "Sabine Schaller's profile (opens in a new tab)"
    )
    expect(model.author?.link?.umami).toMatchObject({
      'data-umami-event': 'link',
      'data-umami-event-base-component': 'blog',
      'data-umami-event-link-text': 'Sabine Schaller',
      'data-umami-event-lang': 'en',
      'data-umami-event-destination-section': 'external'
    })
  })

  it('has no author for a post without one, but keeps the reading time', () => {
    const model = searchResultBylineModel(
      sampleEntry({ author: null }),
      CONTEXT
    )

    expect(model.author).toBeNull()
    expect(model.readingTimeLabel).toBe('3 min read')
  })

  it('has no avatar for an author without an image', () => {
    const model = searchResultBylineModel(
      sampleEntry({ author: { ...SABINE, avatarSrc: null } }),
      CONTEXT
    )

    expect(model.author?.avatarSrc).toBeNull()
    expect(model.author?.name).toBe('Sabine Schaller')
  })

  it('has no link for an author without a profile', () => {
    const model = searchResultBylineModel(
      sampleEntry({ author: { ...SABINE, href: null } }),
      CONTEXT
    )

    expect(model.author?.link).toBeNull()
    expect(model.author?.name).toBe('Sabine Schaller')
  })

  it('fills the reading time into the localized label', () => {
    const model = searchResultBylineModel(sampleEntry({ readingTime: 12 }), {
      ...CONTEXT,
      lang: 'es',
      readingTimeLabel: '{readingTime} min de lectura'
    })

    expect(model.readingTimeLabel).toBe('12 min de lectura')
  })

  it('keeps a $ pattern in an author name verbatim', () => {
    // A string replacement would expand `$&` to the matched token.
    const model = searchResultBylineModel(
      sampleEntry({ author: { ...SABINE, name: 'Jo$&Ann' } }),
      CONTEXT
    )

    expect(model.author?.link?.ariaLabel).toBe(
      "Jo$&Ann's profile (opens in a new tab)"
    )
  })
})
