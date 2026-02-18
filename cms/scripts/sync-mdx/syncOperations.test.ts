import { describe, expect, test } from 'bun:test'
import {
  syncEnglishEntry,
  syncLocaleEntry,
  deleteOrphanedEntries,
  syncUnmatchedLocales
} from './syncOperations'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { ContentTypes } from './config'
import type { SyncContext, SyncResults } from './types'
import type { MDXFile } from './scan'

function createMDXFile(overrides: Partial<MDXFile> = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/test.mdx',
    slug: 'test-page',
    locale: 'en',
    frontmatter: { title: 'Test', slug: 'test-page' },
    content: 'Body',
    isLocalization: false,
    localizes: null,
    ...overrides
  }
}

function createMockStrapi(overrides: Partial<StrapiClient> = {}): StrapiClient {
  return {
    request: async () => ({}),
    getAllEntries: async () => [],
    findBySlug: async () => undefined,
    createEntry: async () => ({ data: { documentId: 'new-1', slug: 'test' } }),
    updateEntry: async () => ({ data: { documentId: '1', slug: 'test' } }),
    createLocalization: async () => ({}),
    updateLocalization: async () => ({}),
    deleteEntry: async () => ({}),
    deleteLocalization: async () => ({}),
    ...overrides
  }
}

const baseConfig: ContentTypes['foundation-pages'] = {
  dir: '/content/foundation-pages',
  apiId: 'foundation-pages'
}

const contentTypes: ContentTypes = {
  'foundation-pages': baseConfig,
  'summit-pages': { dir: '/content/summit', apiId: 'summit-pages' }
}

function createContext(strapi: StrapiClient): SyncContext {
  return { contentTypes, strapi }
}

describe('syncEnglishEntry', () => {
  test('creates when no existing entry', async () => {
    const strapi = createMockStrapi({
      findBySlug: async () => undefined,
      createEntry: async () => ({
        data: { documentId: 'created-1', slug: 'about' }
      })
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }
    const mdx = createMDXFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    const entry = await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(1)
    expect(results.updated).toBe(0)
    expect(entry?.documentId).toBe('created-1')
  })

  test('updates when entry exists', async () => {
    const existing: StrapiEntry = { documentId: 'doc-1', slug: 'about' }
    const strapi = createMockStrapi({
      findBySlug: async () => existing,
      updateEntry: async () => ({ data: existing })
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }
    const mdx = createMDXFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(0)
    expect(results.updated).toBe(1)
  })

  test('dryRun: increments created without calling createEntry', async () => {
    let createCalled = false
    const strapi = createMockStrapi({
      findBySlug: async () => undefined,
      createEntry: async () => {
        createCalled = true
        return { data: { documentId: 'x', slug: 'x' } }
      }
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }
    const mdx = createMDXFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      createContext(strapi),
      results,
      true
    )

    expect(results.created).toBe(1)
    expect(createCalled).toBe(false)
  })
})

describe('syncLocaleEntry', () => {
  const englishEntry: StrapiEntry = {
    documentId: 'en-1',
    slug: 'about',
    locale: 'en'
  }

  test('creates localization when none exists', async () => {
    let createLocalizationCalled = false
    const strapi = createMockStrapi({
      findBySlug: async () => undefined,
      createLocalization: async () => {
        createLocalizationCalled = true
        return {}
      }
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }
    const mdx = createMDXFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      frontmatter: {
        title: 'Sobre',
        slug: 'sobre-nosotros',
        localizes: 'about'
      }
    })

    await syncLocaleEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      englishEntry,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(1)
    expect(createLocalizationCalled).toBe(true)
  })

  test('updates localization when it exists', async () => {
    const existingLocale: StrapiEntry = {
      documentId: 'es-1',
      slug: 'sobre-nosotros',
      locale: 'es'
    }
    let updateLocalizationCalled = false
    const strapi = createMockStrapi({
      findBySlug: async () => existingLocale,
      updateLocalization: async () => {
        updateLocalizationCalled = true
        return {}
      }
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }
    const mdx = createMDXFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      frontmatter: {
        title: 'Sobre',
        slug: 'sobre-nosotros',
        localizes: 'about'
      }
    })

    await syncLocaleEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      englishEntry,
      createContext(strapi),
      results,
      false
    )

    expect(results.updated).toBe(1)
    expect(updateLocalizationCalled).toBe(true)
  })
})

describe('deleteOrphanedEntries', () => {
  test('deletes only entries without MDX file', async () => {
    const mdxSlugsByLocale = new Map<string, Set<string>>()
    mdxSlugsByLocale.set('en', new Set(['kept']))

    const strapiEntries: StrapiEntry[] = [
      { documentId: '1', slug: 'orphan', locale: 'en' },
      { documentId: '2', slug: 'kept', locale: 'en' }
    ]

    const deleteCalledWith: Array<[string, string]> = []
    const strapi = createMockStrapi({
      getAllEntries: async (_apiId, locale) =>
        locale === 'en' ? strapiEntries : [],
      deleteLocalization: async (_apiId, documentId, locale) => {
        deleteCalledWith.push([documentId, locale])
        return {}
      }
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      createContext(strapi),
      results,
      false
    )

    expect(results.deleted).toBe(1)
    expect(deleteCalledWith).toEqual([['1', 'en']])
  })

  test('dryRun: increments deleted without calling deleteLocalization', async () => {
    const mdxSlugsByLocale = new Map<string, Set<string>>()
    const strapi = createMockStrapi({
      getAllEntries: async () => [
        { documentId: '1', slug: 'orphan', locale: 'en' }
      ],
      deleteLocalization: async () => {
        throw new Error('should not be called')
      }
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      createContext(strapi),
      results,
      true
    )

    expect(results.deleted).toBe(1)
  })
})

describe('syncUnmatchedLocales', () => {
  test('creates locale when match found in Strapi', async () => {
    const localeMdx = createMDXFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us',
      frontmatter: {
        title: 'Sobre',
        slug: 'sobre-nosotros',
        localizes: 'about-us'
      }
    })
    const matchedSlugs = new Set<string>()
    const allStrapiEntries: StrapiEntry[] = [
      { documentId: 'en-1', slug: 'about-us', locale: 'en' }
    ]

    const strapi = createMockStrapi({
      getAllEntries: async () => allStrapiEntries,
      findBySlug: async () => undefined,
      createLocalization: async () => ({})
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(1)
    expect(matchedSlugs.has('es:sobre-nosotros')).toBe(true)
  })

  test('does not create when no matching English entry in Strapi', async () => {
    const localeMdx = createMDXFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'nonexistent',
      frontmatter: {
        title: 'Sobre',
        slug: 'sobre-nosotros',
        localizes: 'nonexistent'
      }
    })
    const matchedSlugs = new Set<string>()
    const strapi = createMockStrapi({
      getAllEntries: async () => []
    })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(0)
  })

  test('skips already matched locale', async () => {
    const localeMdx = createMDXFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const matchedSlugs = new Set<string>(['es:sobre-nosotros'])
    const strapi = createMockStrapi({ getAllEntries: async () => [] })
    const results: SyncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    }

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      createContext(strapi),
      results,
      false
    )

    expect(results.created).toBe(0)
  })
})
