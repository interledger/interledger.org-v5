import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildMdxSlugsByLocale,
  hasMdxFile,
  findMatchingLocales
} from './localeMatch'
import type { MDXFile } from './scan'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Builds a lookup table so we can quickly check if an MDX file exists for a given locale
// before deleting Strapi entries. Without this, we'd have to scan the file list on every check.
describe('buildMdxSlugsByLocale', () => {
  it('returns empty map for empty input', () => {
    const map = buildMdxSlugsByLocale([])

    expect(map.size).toBe(0)
  })

  it('groups single file by locale', () => {
    const mdx = { slug: 'about-us', locale: 'en' } as unknown as MDXFile

    const map = buildMdxSlugsByLocale([mdx])

    expect(map.get('en')?.has('about-us')).toBe(true)
  })

  it('groups multiple files by their locales', () => {
    const files = [
      { slug: 'about', locale: 'en' },
      { slug: 'home', locale: 'en' },
      { slug: 'sobre-nosotros', locale: 'es' }
    ] as unknown as MDXFile[]

    const map = buildMdxSlugsByLocale(files)

    expect(map.get('en')?.has('about')).toBe(true)
    expect(map.get('en')?.has('home')).toBe(true)
    expect(map.get('es')?.has('sobre-nosotros')).toBe(true)
  })

  // English files often have empty string locale from the scanner. We need to normalize
  // these to 'en' so they match how Strapi stores the default locale.
  it('defaults locale to en when locale is empty string', () => {
    const mdx = { slug: 'page', locale: '' } as unknown as MDXFile

    const map = buildMdxSlugsByLocale([mdx])

    expect(map.get('en')?.has('page')).toBe(true)
    // Should not create an empty-string key — that would cause lookups to fail
    expect(map.has('')).toBe(false)
  })

  // Same as above, but for undefined instead of empty string
  it('defaults locale to en when locale is undefined', () => {
    const mdx = { slug: 'page', locale: undefined } as unknown as MDXFile

    const map = buildMdxSlugsByLocale([mdx])

    expect(map.get('en')?.has('page')).toBe(true)
  })

  it('handles multiple slugs in same locale', () => {
    const files = [
      { slug: 'page-1', locale: 'de' },
      { slug: 'page-2', locale: 'de' },
      { slug: 'page-3', locale: 'de' }
    ] as unknown as MDXFile[]

    const map = buildMdxSlugsByLocale(files)

    expect(map.get('de')?.size).toBe(3)
  })
})

// Simple lookup used by deleteOrphanedEntries to check if a Strapi entry
// still has a corresponding MDX file before deleting it.
describe('hasMdxFile', () => {
  it('returns true when slug exists for locale', () => {
    const map = new Map<string, Set<string>>([['es', new Set(['sobre-nosotros'])]])

    expect(hasMdxFile(map, 'es', 'sobre-nosotros')).toBe(true)
  })

  it('returns false when locale does not exist in map', () => {
    const map = new Map<string, Set<string>>()

    expect(hasMdxFile(map, 'es', 'any-slug')).toBe(false)
  })

  it('returns false when slug does not exist in locale', () => {
    const map = new Map<string, Set<string>>([['es', new Set(['existing-slug'])]])

    expect(hasMdxFile(map, 'es', 'different-slug')).toBe(false)
  })

  it('returns false for empty set', () => {
    const map = new Map<string, Set<string>>([['en', new Set()]])

    expect(hasMdxFile(map, 'en', 'any-slug')).toBe(false)
  })
})

// Finds which locale MDX files translate a given English entry by checking the `localizes`
// frontmatter field. This powers the main sync loop where we process English files first,
// then sync their translations.
describe('findMatchingLocales', () => {
  it('matches locale file via localizes field', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'sobre-nosotros', locale: 'es', localizes: 'about-us' }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(1)
    expect(matches[0].localeMdx.slug).toBe('sobre-nosotros')
    expect(matches[0].matchReason).toBe('localizes: about-us')
  })

  // If localizes points to a different slug, it's not a match for this English entry.
  // It might be a valid translation of a different page.
  it('returns empty array when localizes points to different slug', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'sobre-nosotros', locale: 'es', localizes: 'other-page' }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(0)
  })

  it('returns empty array when localizes is null', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'sobre-nosotros', locale: 'es', localizes: null }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(0)
  })

  it('returns empty array for empty locale files', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile

    const matches = findMatchingLocales(englishMdx, [])

    expect(matches).toHaveLength(0)
  })

  // A single English page can have translations in multiple languages
  it('matches multiple locale files for same English entry', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'sobre-nosotros', locale: 'es', localizes: 'about-us' },
      { slug: 'uber-uns', locale: 'de', localizes: 'about-us' },
      { slug: 'a-propos', locale: 'fr', localizes: 'about-us' }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(3)
    expect(matches.map((m) => m.localeMdx.slug)).toEqual([
      'sobre-nosotros',
      'uber-uns',
      'a-propos'
    ])
  })

  // Must be exact match — "about" should not match "about-us" or "aboutpage"
  it('only matches files where localizes equals english slug exactly', () => {
    const englishMdx = { slug: 'about' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'match', locale: 'es', localizes: 'about' },
      { slug: 'no-match-1', locale: 'de', localizes: 'about-us' },
      { slug: 'no-match-2', locale: 'fr', localizes: 'aboutpage' }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(1)
    expect(matches[0].localeMdx.slug).toBe('match')
  })

  // Locale files without localizes are "orphans" — they'll be handled separately
  // by syncUnmatchedLocales which tries to find their English parent in Strapi
  it('returns empty array when localizes is undefined', () => {
    const englishMdx = { slug: 'about-us' } as unknown as MDXFile
    const localeFiles = [
      { slug: 'orphan', locale: 'es', localizes: undefined }
    ] as unknown as MDXFile[]

    const matches = findMatchingLocales(englishMdx, localeFiles)

    expect(matches).toHaveLength(0)
  })
})
