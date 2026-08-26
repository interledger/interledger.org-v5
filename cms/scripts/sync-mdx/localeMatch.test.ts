import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildMdxSlugsByLocale,
  hasMdxFile,
  findMatchingLocales
} from './localeMatch'
import { createMdxFile } from './test-utils'

/** Content type keyed on pathSlug alone (the default). */
const BY_SLUG = {}
/** Cross-section content type keyed on (section, pathSlug). */
const BY_SECTION_AND_SLUG = { sectionScopedIdentity: true }

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Builds a lookup table so we can quickly check if an MDX file exists for a given locale
// before deleting Strapi entries. Without this, we'd have to scan the file list on every check.
describe('buildMdxSlugsByLocale', () => {
  it('returns empty map for empty input', () => {
    const map = buildMdxSlugsByLocale([], BY_SLUG)

    expect(map.size).toBe(0)
  })

  it('groups single file by locale', () => {
    const mdx = createMdxFile({ pathSlug: 'about-us' })

    const map = buildMdxSlugsByLocale([mdx], BY_SLUG)

    expect(map.get('en')?.has('about-us')).toBe(true)
  })

  it('groups multiple files by their locales', () => {
    const files = [
      createMdxFile({ pathSlug: 'about' }),
      createMdxFile({ pathSlug: 'home' }),
      createMdxFile({ pathSlug: 'sobre-nosotros', locale: 'es' })
    ]

    const map = buildMdxSlugsByLocale(files, BY_SLUG)

    expect(map.get('en')?.has('about')).toBe(true)
    expect(map.get('en')?.has('home')).toBe(true)
    expect(map.get('es')?.has('sobre-nosotros')).toBe(true)
  })

  // English files often have empty string locale from the scanner. We need to normalize
  // these to 'en' so they match how Strapi stores the default locale.
  it('defaults locale to en when locale is empty string', () => {
    const mdx = createMdxFile({ pathSlug: 'page', locale: '' })

    const map = buildMdxSlugsByLocale([mdx], BY_SLUG)

    expect(map.get('en')?.has('page')).toBe(true)
    // Should not create an empty-string key — that would cause lookups to fail
    expect(map.has('')).toBe(false)
  })

  // Same as above, but for undefined instead of empty string
  it('defaults locale to en when locale is undefined', () => {
    const mdx = createMdxFile({ pathSlug: 'page', locale: undefined })

    const map = buildMdxSlugsByLocale([mdx], BY_SLUG)

    expect(map.get('en')?.has('page')).toBe(true)
  })

  // The foundation FAQ and the hackathon FAQ share pathSlug 'faq'. Keyed on
  // pathSlug alone they collapse into one entry, which is INTORG-1132.
  it('keeps two sections that share a pathSlug apart when section-scoped', () => {
    const files = [
      createMdxFile({ pathSlug: 'faq', section: 'foundation' }),
      createMdxFile({ pathSlug: 'faq', section: 'hackathon' })
    ]

    const map = buildMdxSlugsByLocale(files, BY_SECTION_AND_SLUG)

    expect(map.get('en')?.size).toBe(2)
    expect(
      hasMdxFile(map, 'en', { pathSlug: 'faq', section: 'foundation' })
    ).toBe(true)
    expect(
      hasMdxFile(map, 'en', { pathSlug: 'faq', section: 'hackathon' })
    ).toBe(true)
    expect(hasMdxFile(map, 'en', { pathSlug: 'faq', section: 'summit' })).toBe(
      false
    )
  })

  it('ignores section when the content type is not section-scoped', () => {
    const files = [
      createMdxFile({ pathSlug: 'faq', section: 'foundation' }),
      createMdxFile({ pathSlug: 'faq', section: 'hackathon' })
    ]

    const map = buildMdxSlugsByLocale(files, BY_SLUG)

    expect(map.get('en')?.size).toBe(1)
    expect(hasMdxFile(map, 'en', { pathSlug: 'faq', section: null })).toBe(true)
  })

  it('handles multiple slugs in same locale', () => {
    const files = [
      createMdxFile({ pathSlug: 'page-1', locale: 'de' }),
      createMdxFile({ pathSlug: 'page-2', locale: 'de' }),
      createMdxFile({ pathSlug: 'page-3', locale: 'de' })
    ]

    const map = buildMdxSlugsByLocale(files, BY_SLUG)

    expect(map.get('de')?.size).toBe(3)
  })
})

// Simple lookup used by deleteOrphanedEntries to check if a Strapi entry
// still has a corresponding MDX file before deleting it.
describe('hasMdxFile', () => {
  it('returns true when slug exists for locale', () => {
    const map = new Map<string, Set<string>>([
      ['es', new Set(['sobre-nosotros'])]
    ])

    expect(
      hasMdxFile(map, 'es', { pathSlug: 'sobre-nosotros', section: null })
    ).toBe(true)
  })

  it('returns false when locale does not exist in map', () => {
    const map = new Map<string, Set<string>>()

    expect(hasMdxFile(map, 'es', { pathSlug: 'any-slug', section: null })).toBe(
      false
    )
  })

  it('returns false when slug does not exist in locale', () => {
    const map = new Map<string, Set<string>>([
      ['es', new Set(['existing-slug'])]
    ])

    expect(
      hasMdxFile(map, 'es', { pathSlug: 'different-slug', section: null })
    ).toBe(false)
  })

  it('returns false for empty set', () => {
    const map = new Map<string, Set<string>>([['en', new Set()]])

    expect(hasMdxFile(map, 'en', { pathSlug: 'any-slug', section: null })).toBe(
      false
    )
  })
})

// Finds which locale MDX files translate a given English entry by checking the `localizes`
// frontmatter field. This powers the main sync loop where we process English files first,
// then sync their translations.
describe('findMatchingLocales', () => {
  it('matches locale file via localizes field', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })
    const localeFiles = [
      createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        localizes: 'about-us'
      })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(1)
    expect(matches[0].localeMdx.pathSlug).toBe('sobre-nosotros')
    expect(matches[0].matchReason).toBe('localizes: about-us')
  })

  // If localizes points to a different slug, it's not a match for this English entry.
  // It might be a valid translation of a different page.
  it('returns empty array when localizes points to different slug', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })
    const localeFiles = [
      createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        localizes: 'other-page'
      })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(0)
  })

  it('returns empty array when localizes is null', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })
    const localeFiles = [
      createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        localizes: null
      })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(0)
  })

  it('returns empty array for empty locale files', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })

    const matches = findMatchingLocales(englishMdx, [], BY_SLUG)

    expect(matches).toHaveLength(0)
  })

  // A single English page can have translations in multiple languages
  it('matches multiple locale files for same English entry', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })
    const localeFiles = [
      createMdxFile({
        pathSlug: 'sobre-nosotros',
        locale: 'es',
        localizes: 'about-us'
      }),
      createMdxFile({
        pathSlug: 'uber-uns',
        locale: 'de',
        localizes: 'about-us'
      }),
      createMdxFile({
        pathSlug: 'a-propos',
        locale: 'fr',
        localizes: 'about-us'
      })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(3)
    expect(matches.map((m) => m.localeMdx.pathSlug)).toEqual([
      'sobre-nosotros',
      'uber-uns',
      'a-propos'
    ])
  })

  // Must be exact match — "about" should not match "about-us" or "aboutpage"
  it('only matches files where localizes equals english slug exactly', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about' })
    const localeFiles = [
      createMdxFile({ pathSlug: 'match', locale: 'es', localizes: 'about' }),
      createMdxFile({
        pathSlug: 'no-match-1',
        locale: 'de',
        localizes: 'about-us'
      }),
      createMdxFile({
        pathSlug: 'no-match-2',
        locale: 'fr',
        localizes: 'aboutpage'
      })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(1)
    expect(matches[0].localeMdx.pathSlug).toBe('match')
  })

  // Two sections share pathSlug 'faq', so both their ES files say
  // `localizes: faq`. Each must attach to its own section's English entry.
  it('requires a matching section when the content type is section-scoped', () => {
    const englishMdx = createMdxFile({
      pathSlug: 'faq',
      section: 'foundation'
    })
    const localeFiles = [
      createMdxFile({
        pathSlug: 'preguntas-frecuentes',
        section: 'foundation',
        locale: 'es',
        localizes: 'faq'
      }),
      createMdxFile({
        pathSlug: 'preguntas-hackathon',
        section: 'hackathon',
        locale: 'es',
        localizes: 'faq'
      })
    ]

    const matches = findMatchingLocales(
      englishMdx,
      localeFiles,
      BY_SECTION_AND_SLUG
    )

    expect(matches).toHaveLength(1)
    expect(matches[0].localeMdx.pathSlug).toBe('preguntas-frecuentes')
  })

  // Locale files without localizes are "orphans" — they'll be handled separately
  // by syncUnmatchedLocales which tries to find their English parent in Strapi
  it('returns empty array when localizes is undefined', () => {
    const englishMdx = createMdxFile({ pathSlug: 'about-us' })
    const localeFiles = [
      createMdxFile({ pathSlug: 'orphan', locale: 'es', localizes: undefined })
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, BY_SLUG)

    expect(matches).toHaveLength(0)
  })
})
