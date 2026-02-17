import { describe, expect, test } from 'bun:test'
import {
  buildMdxSlugsByLocale,
  hasMdxFile,
  findMatchingLocales
} from './localeMatch'
import type { MDXFile } from './scan'

function createMDXFile(overrides: Partial<MDXFile> = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/test.mdx',
    slug: 'test-slug',
    locale: 'en',
    frontmatter: {},
    content: '',
    isLocalization: false,
    localizes: null,
    ...overrides
  }
}

describe('buildMdxSlugsByLocale', () => {
  const cases: Array<{
    desc: string
    mdxFiles: MDXFile[]
    expectedLocales: string[]
    expectedSlugsFor: Array<{ locale: string; slugs: string[] }>
  }> = [
    {
      desc: 'empty input yields empty map',
      mdxFiles: [],
      expectedLocales: [],
      expectedSlugsFor: []
    },
    {
      desc: 'single file in one locale',
      mdxFiles: [createMDXFile({ slug: 'about-us', locale: 'en' })],
      expectedLocales: ['en'],
      expectedSlugsFor: [{ locale: 'en', slugs: ['about-us'] }]
    },
    {
      desc: 'multiple locales with multiple slugs',
      mdxFiles: [
        createMDXFile({ slug: 'about', locale: 'en' }),
        createMDXFile({ slug: 'home', locale: 'en' }),
        createMDXFile({ slug: 'sobre-nosotros', locale: 'es' })
      ],
      expectedLocales: ['en', 'es'],
      expectedSlugsFor: [
        { locale: 'en', slugs: ['about', 'home'] },
        { locale: 'es', slugs: ['sobre-nosotros'] }
      ]
    },
    {
      desc: 'locale defaults to en when missing',
      mdxFiles: [createMDXFile({ slug: 'page', locale: '' })],
      expectedLocales: ['en'],
      expectedSlugsFor: [{ locale: 'en', slugs: ['page'] }]
    }
  ]
  for (const { desc, mdxFiles, expectedSlugsFor } of cases) {
    test(desc, () => {
      const map = buildMdxSlugsByLocale(mdxFiles)
      for (const { locale, slugs } of expectedSlugsFor) {
        const set = map.get(locale)
        expect(set).toBeDefined()
        expect(Array.from(set!)).toEqual(expect.arrayContaining(slugs))
      }
    })
  }
})

describe('hasMdxFile', () => {
  test('returns true when slug exists for locale', () => {
    const map = new Map<string, Set<string>>()
    map.set('es', new Set(['sobre-nosotros']))
    expect(hasMdxFile(map, 'es', 'sobre-nosotros')).toBe(true)
  })
  test('returns false when locale missing', () => {
    const map = new Map<string, Set<string>>()
    expect(hasMdxFile(map, 'es', 'x')).toBe(false)
  })
  test('returns false when slug not in locale', () => {
    const map = new Map<string, Set<string>>()
    map.set('es', new Set(['a']))
    expect(hasMdxFile(map, 'es', 'b')).toBe(false)
  })
})

describe('findMatchingLocales', () => {
  const cases: Array<{
    desc: string
    englishMdx: MDXFile
    localeFiles: MDXFile[]
    expectedCount: number
    expectedSlugs?: string[]
  }> = [
    {
      desc: 'matches via localizes field',
      englishMdx: createMDXFile({ slug: 'about-us', locale: 'en', isLocalization: false }),
      localeFiles: [
        createMDXFile({
          slug: 'sobre-nosotros',
          locale: 'es',
          isLocalization: true,
          localizes: 'about-us'
        })
      ],
      expectedCount: 1,
      expectedSlugs: ['sobre-nosotros']
    },
    {
      desc: 'no match when localizes points to different slug',
      englishMdx: createMDXFile({ slug: 'about-us' }),
      localeFiles: [
        createMDXFile({
          slug: 'sobre-nosotros',
          locale: 'es',
          isLocalization: true,
          localizes: 'other-page'
        })
      ],
      expectedCount: 0
    },
    {
      desc: 'no match when localizes is null',
      englishMdx: createMDXFile({ slug: 'about-us' }),
      localeFiles: [
        createMDXFile({
          slug: 'sobre-nosotros',
          locale: 'es',
          isLocalization: true,
          localizes: null
        })
      ],
      expectedCount: 0
    },
    {
      desc: 'multiple locale files matching same English',
      englishMdx: createMDXFile({ slug: 'about-us' }),
      localeFiles: [
        createMDXFile({ slug: 'a', locale: 'es', isLocalization: true, localizes: 'about-us' }),
        createMDXFile({ slug: 'b', locale: 'de', isLocalization: true, localizes: 'about-us' })
      ],
      expectedCount: 2,
      expectedSlugs: ['a', 'b']
    },
    {
      desc: 'empty locale files',
      englishMdx: createMDXFile({ slug: 'about-us' }),
      localeFiles: [],
      expectedCount: 0
    }
  ]
  for (const { desc, englishMdx, localeFiles, expectedCount, expectedSlugs } of cases) {
    test(desc, () => {
      const matches = findMatchingLocales(englishMdx, localeFiles)
      expect(matches).toHaveLength(expectedCount)
      if (expectedSlugs) {
        expect(matches.map((m) => m.localeMdx.slug)).toEqual(expect.arrayContaining(expectedSlugs))
      }
    })
  }
})
