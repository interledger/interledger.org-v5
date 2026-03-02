import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  syncEnglishEntry,
  syncLocaleEntry,
  deleteOrphanedEntries,
  syncUnmatchedLocales
} from './syncOperations'
import type { StrapiEntry } from './strapiClient'
import type { ContentTypes } from './config'
import type { SyncContext, SyncResults } from './types'
import { createMdxFile } from './test-utils'

vi.mock('./localeMatch', () => ({
  hasMdxFile: vi.fn(() => false)
}))

vi.mock('./scan', () => ({
  getLocalesToCheck: vi.fn(() => ['en', 'es'])
}))

import { hasMdxFile } from './localeMatch'
import { getLocalesToCheck } from './scan'

const mockedHasMdxFile = vi.mocked(hasMdxFile)
const mockedGetLocalesToCheck = vi.mocked(getLocalesToCheck)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function createMockStrapi() {
  return {
    request: vi.fn().mockResolvedValue({}),
    getAllEntries: vi.fn().mockResolvedValue([]),
    findBySlug: vi.fn().mockResolvedValue(undefined),
    findUploadByUrl: vi.fn().mockResolvedValue(null),
    createEntry: vi
      .fn()
      .mockResolvedValue({ data: { documentId: 'new-1', slug: 'test' } }),
    updateEntry: vi
      .fn()
      .mockResolvedValue({ data: { documentId: '1', slug: 'test' } }),
    createLocalization: vi.fn().mockResolvedValue({}),
    updateLocalization: vi.fn().mockResolvedValue({}),
    deleteEntry: vi.fn().mockResolvedValue({}),
    deleteLocalization: vi.fn().mockResolvedValue({})
  }
}

const buildPayloadMock = vi
  .fn()
  .mockResolvedValue({ title: 'Mocked Payload', slug: 'mocked' })

const baseConfig = {
  dir: '/content/foundation-pages',
  apiId: 'foundation-pages',
  buildPayload: buildPayloadMock
}

const contentTypes = {
  'foundation-pages': baseConfig,
  'summit-pages': {
    dir: '/content/summit',
    apiId: 'summit-pages',
    buildPayload: vi
      .fn()
      .mockResolvedValue({ title: 'Mocked Payload', slug: 'mocked' })
  }
} as unknown as ContentTypes

function createResults(): SyncResults {
  return { created: 0, updated: 0, deleted: 0, errors: 0 }
}

// Syncs English entries to Strapi — creates new or updates existing.
// English entries are synced first because locale entries link to them.
describe('syncEnglishEntry', () => {
  it('creates entry when no existing entry found', async () => {
    const strapi = createMockStrapi()
    // findBySlug returns undefined = no existing entry, so we create
    strapi.findBySlug.mockResolvedValue(undefined)
    strapi.createEntry.mockResolvedValue({
      data: { documentId: 'created-1', slug: 'about' }
    })
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' },
      content: 'Body'
    })

    const entry = await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      false
    )

    expect(strapi.createEntry).toHaveBeenCalledWith(
      'foundation-pages',
      expect.any(Object)
    )
    expect(results.created).toBe(1)
    expect(results.updated).toBe(0)
    expect(entry?.documentId).toBe('created-1')
  })

  it('updates entry when existing entry found', async () => {
    // Simulate finding an existing entry in Strapi
    const existing: StrapiEntry = { documentId: 'doc-1', slug: 'about' }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existing)
    strapi.updateEntry.mockResolvedValue({ data: existing })
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      false
    )

    expect(strapi.updateEntry).toHaveBeenCalledWith(
      'foundation-pages',
      'doc-1',
      expect.any(Object)
    )
    expect(results.created).toBe(0)
    expect(results.updated).toBe(1)
  })

  // Existing entry is passed to buildPayload so it can preserve hero/content
  // that wasn't specified in the MDX file
  it('passes existing entry to buildPayload for hero fallback', async () => {
    const existing: StrapiEntry = {
      documentId: 'doc-1',
      slug: 'about',
      hero: { url: '/existing-hero.jpg' }
    }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      false
    )

    expect(buildPayloadMock).toHaveBeenCalledWith(mdx, strapi, existing)
  })

  // Dry run mode: count what would happen without actually calling Strapi
  it('dry run increments created counter without calling createEntry', async () => {
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      true
    )

    // Should NOT actually create — that's the point of dry run
    expect(strapi.createEntry).not.toHaveBeenCalled()
    expect(results.created).toBe(1)
  })

  it('dry run increments updated counter without calling updateEntry', async () => {
    const existing: StrapiEntry = { documentId: 'doc-1', slug: 'about' }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'about',
      frontmatter: { title: 'About', slug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      true
    )

    expect(strapi.updateEntry).not.toHaveBeenCalled()
    expect(results.updated).toBe(1)
  })

  it('returns existing entry on dry run update', async () => {
    const existing: StrapiEntry = { documentId: 'doc-1', slug: 'about' }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({ slug: 'about' })

    const entry = await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      true
    )

    expect(entry).toBe(existing)
  })

  // Dry run creates need to return something so locale sync can continue
  it('returns dry run placeholder entry on dry run create', async () => {
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({ slug: 'new-page' })

    const entry = await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      true
    )

    expect(entry?.documentId).toBe('dry-run-id')
    expect(entry?.slug).toBe('new-page')
  })
})

// Syncs locale entries as localizations of an English parent entry.
// Uses Strapi's i18n localization API rather than creating standalone entries.
describe('syncLocaleEntry', () => {
  const englishEntry: StrapiEntry = {
    documentId: 'en-1',
    slug: 'about',
    locale: 'en'
  }

  it('creates localization when none exists', async () => {
    const strapi = createMockStrapi()
    // No existing locale entry = create new localization
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
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
      ctx,
      results,
      false
    )

    expect(strapi.createLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      'en-1',
      'es',
      expect.any(Object)
    )
    expect(results.created).toBe(1)
  })

  it('updates localization when it exists', async () => {
    // Simulate existing Spanish localization
    const existingLocale: StrapiEntry = {
      documentId: 'es-1',
      slug: 'sobre-nosotros',
      locale: 'es'
    }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existingLocale)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
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
      ctx,
      results,
      false
    )

    expect(strapi.updateLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      'en-1',
      'es',
      expect.any(Object)
    )
    expect(results.updated).toBe(1)
  })

  // Same locale defaulting as buildMdxSlugsByLocale — keeps behavior consistent
  it('defaults locale to en when mdx.locale is undefined', async () => {
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'some-page',
      locale: undefined,
      frontmatter: { title: 'Some', slug: 'some-page' }
    })

    await syncLocaleEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      englishEntry,
      ctx,
      results,
      false
    )

    expect(strapi.findBySlug).toHaveBeenCalledWith(
      'foundation-pages',
      'some-page',
      'en'
    )
  })

  it('dry run increments created counter without calling createLocalization', async () => {
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es'
    })

    await syncLocaleEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      englishEntry,
      ctx,
      results,
      true
    )

    expect(strapi.createLocalization).not.toHaveBeenCalled()
    expect(results.created).toBe(1)
  })

  it('dry run increments updated counter without calling updateLocalization', async () => {
    const existingLocale: StrapiEntry = {
      documentId: 'es-1',
      slug: 'sobre-nosotros',
      locale: 'es'
    }
    const strapi = createMockStrapi()
    strapi.findBySlug.mockResolvedValue(existingLocale)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es'
    })

    await syncLocaleEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      englishEntry,
      ctx,
      results,
      true
    )

    expect(strapi.updateLocalization).not.toHaveBeenCalled()
    expect(results.updated).toBe(1)
  })
})

// Removes Strapi entries that no longer have corresponding MDX files.
// Runs after sync to clean up deleted pages.
describe('deleteOrphanedEntries', () => {
  it('deletes entries that have no matching MDX file', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    // hasMdxFile returns false = no MDX file exists, so this is an orphan
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: '1', slug: 'orphan', locale: 'en' }
    ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map<string, Set<string>>()

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      false
    )

    expect(strapi.deleteLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      '1',
      'en'
    )
    expect(results.deleted).toBe(1)
  })

  it('skips entries that have matching MDX file', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    // hasMdxFile returns true = MDX file exists, don't delete
    mockedHasMdxFile.mockReturnValue(true)
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: '2', slug: 'kept', locale: 'en' }
    ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map([['en', new Set(['kept'])]])

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      false
    )

    // Should NOT delete — the MDX file still exists
    expect(strapi.deleteLocalization).not.toHaveBeenCalled()
    expect(results.deleted).toBe(0)
  })

  it('processes multiple locales', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    strapi.getAllEntries
      .mockResolvedValueOnce([
        { documentId: '1', slug: 'orphan-en', locale: 'en' }
      ])
      .mockResolvedValueOnce([
        { documentId: '2', slug: 'orphan-es', locale: 'es' }
      ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map<string, Set<string>>()

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      false
    )

    expect(strapi.getAllEntries).toHaveBeenCalledTimes(2)
    expect(results.deleted).toBe(2)
  })

  // Entry.locale might differ from the query locale if Strapi returns mixed results.
  // We use the actual entry locale for the hasMdxFile check and delete call.
  it('uses entry.locale when available instead of loop locale', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    // Querying 'en' but entry has locale 'fr' — use 'fr' for operations
    strapi.getAllEntries.mockResolvedValue([
      { documentId: '1', slug: 'test', locale: 'fr' }
    ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map<string, Set<string>>()

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      false
    )

    expect(mockedHasMdxFile).toHaveBeenCalledWith(
      mdxSlugsByLocale,
      'fr',
      'test'
    )
    expect(strapi.deleteLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      '1',
      'fr'
    )
  })

  it('dry run increments deleted counter without calling deleteLocalization', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: '1', slug: 'orphan', locale: 'en' }
    ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map<string, Set<string>>()

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      true
    )

    expect(strapi.deleteLocalization).not.toHaveBeenCalled()
    expect(results.deleted).toBe(1)
  })

  // Delete errors shouldn't crash the whole sync — log and continue
  it('increments errors counter when delete fails', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: '1', slug: 'failing', locale: 'en' }
    ])
    strapi.deleteLocalization.mockRejectedValue(new Error('Delete failed'))
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdxSlugsByLocale = new Map<string, Set<string>>()

    await deleteOrphanedEntries(
      'foundation-pages',
      baseConfig,
      contentTypes,
      mdxSlugsByLocale,
      ctx,
      results,
      false
    )

    expect(results.errors).toBe(1)
    expect(results.deleted).toBe(0)
  })
})

// Handles locale MDX files that weren't matched during the main English sync pass.
// This can happen when the English file doesn't exist in MDX but does exist in Strapi.
describe('syncUnmatchedLocales', () => {
  it('creates localization when match found in Strapi', async () => {
    const localeMdx = createMdxFile({
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
    // Simulate English entry existing in Strapi (but not in MDX)
    const allStrapiEntries: StrapiEntry[] = [
      { documentId: 'en-1', slug: 'about-us', locale: 'en' }
    ]
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue(allStrapiEntries)
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    expect(strapi.createLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      'en-1',
      'es',
      expect.any(Object)
    )
    expect(results.created).toBe(1)
  })

  // Track which locales we've processed to avoid duplicates
  it('adds matched locale to matchedSlugs set', async () => {
    const localeMdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', slug: 'about-us', locale: 'en' }
    ])
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    expect(matchedSlugs.has('es:sobre-nosotros')).toBe(true)
  })

  // Can't create a localization without an English parent
  it('does not create when no matching English entry in Strapi', async () => {
    const localeMdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'nonexistent'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    // Should NOT create — no English parent to attach to
    expect(strapi.createLocalization).not.toHaveBeenCalled()
    expect(results.created).toBe(0)
  })

  // Skip locales already processed in the main sync loop
  it('skips already matched locale slugs', async () => {
    const localeMdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const strapi = createMockStrapi()
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>(['es:sobre-nosotros'])

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    // Should skip entirely — no API calls
    expect(strapi.getAllEntries).not.toHaveBeenCalled()
    expect(results.created).toBe(0)
  })

  it('returns early when no unmatched locales', async () => {
    const strapi = createMockStrapi()
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [],
      matchedSlugs,
      ctx,
      results,
      false
    )

    expect(strapi.getAllEntries).not.toHaveBeenCalled()
  })

  it('defaults locale to en when mdx.locale is undefined', async () => {
    const localeMdx = createMdxFile({
      slug: 'some-page',
      locale: undefined,
      isLocalization: true,
      localizes: 'english-page'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', slug: 'english-page', locale: 'en' }
    ])
    strapi.findBySlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    expect(matchedSlugs.has('en:some-page')).toBe(true)
  })

  it('increments errors counter when syncLocaleEntry fails', async () => {
    const localeMdx = createMdxFile({
      slug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', slug: 'about-us', locale: 'en' }
    ])
    strapi.findBySlug.mockResolvedValue(undefined)
    strapi.createLocalization.mockRejectedValue(new Error('API error'))
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    expect(results.errors).toBe(1)
  })

  // localizes: null means this locale file doesn't know which English page it translates
  it('does not match when localizes is null', async () => {
    const localeMdx = createMdxFile({
      slug: 'orphan-page',
      locale: 'es',
      isLocalization: true,
      localizes: null
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', slug: 'about-us', locale: 'en' }
    ])
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const matchedSlugs = new Set<string>()

    await syncUnmatchedLocales(
      'foundation-pages',
      baseConfig,
      [localeMdx],
      matchedSlugs,
      ctx,
      results,
      false
    )

    // Can't match without knowing which English page to link to
    expect(strapi.createLocalization).not.toHaveBeenCalled()
    expect(results.created).toBe(0)
  })
})
