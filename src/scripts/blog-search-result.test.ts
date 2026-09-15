import { describe, it, expect, afterAll } from 'vitest'

// Pinned to a negative-offset zone before importing the module under test:
// CI runs in UTC, where a UTC-pinned formatter and a zone-naive one agree, so
// the regression this guards against is invisible unless the process sits west
// of Greenwich. Vitest isolates test files, and the original is restored below.
const originalTz = process.env.TZ
process.env.TZ = 'America/New_York'

const { formatSearchResultDate } = await import('./blog-search-result')

afterAll(() => {
  if (originalTz === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTz
  }
})

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
