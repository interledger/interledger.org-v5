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
    findByPathSlug: vi.fn().mockResolvedValue(undefined),
    findUploadByUrl: vi.fn().mockResolvedValue(null),
    createEntry: vi
      .fn()
      .mockResolvedValue({ data: { documentId: 'new-1', pathSlug: 'test' } }),
    updateEntry: vi
      .fn()
      .mockResolvedValue({ data: { documentId: '1', pathSlug: 'test' } }),
    createLocalization: vi.fn().mockResolvedValue({}),
    updateLocalization: vi.fn().mockResolvedValue({}),
    deleteEntry: vi.fn().mockResolvedValue({}),
    deleteLocalization: vi.fn().mockResolvedValue({})
  }
}

const buildPayloadMock = vi
  .fn()
  .mockResolvedValue({ title: 'Mocked Payload', pathSlug: 'mocked' })

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
      .mockResolvedValue({ title: 'Mocked Payload', pathSlug: 'mocked' })
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
    // findByPathSlug returns undefined = no existing entry, so we create
    strapi.findByPathSlug.mockResolvedValue(undefined)
    strapi.createEntry.mockResolvedValue({
      data: { documentId: 'created-1', pathSlug: 'about' }
    })
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'about',
      frontmatter: { title: 'About', pathSlug: 'about' },
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
    const existing: StrapiEntry = { documentId: 'doc-1', pathSlug: 'about' }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existing)
    strapi.updateEntry.mockResolvedValue({ data: existing })
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'about',
      frontmatter: { title: 'About', pathSlug: 'about' }
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
      pathSlug: 'about',
      hero: { url: '/existing-hero.jpg' }
    }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'about',
      frontmatter: { title: 'About', pathSlug: 'about' }
    })

    await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      false
    )

    expect(buildPayloadMock).toHaveBeenCalledWith(mdx, strapi, existing, false)
  })

  // Dry run mode: count what would happen without actually calling Strapi
  it('dry run increments created counter without calling createEntry', async () => {
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'about',
      frontmatter: { title: 'About', pathSlug: 'about' }
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
    const existing: StrapiEntry = { documentId: 'doc-1', pathSlug: 'about' }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'about',
      frontmatter: { title: 'About', pathSlug: 'about' }
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
    const existing: StrapiEntry = { documentId: 'doc-1', pathSlug: 'about' }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existing)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({ pathSlug: 'about' })

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
    strapi.findByPathSlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({ pathSlug: 'new-page' })

    const entry = await syncEnglishEntry(
      'foundation-pages',
      baseConfig,
      mdx,
      ctx,
      results,
      true
    )

    expect(entry?.documentId).toBe('dry-run-id')
    expect(entry?.pathSlug).toBe('new-page')
  })
})

// Syncs locale entries as localizations of an English parent entry.
// Uses Strapi's i18n localization API rather than creating standalone entries.
describe('syncLocaleEntry', () => {
  const englishEntry: StrapiEntry = {
    documentId: 'en-1',
    pathSlug: 'about',
    locale: 'en'
  }

  it('creates localization when none exists', async () => {
    const strapi = createMockStrapi()
    // No existing locale entry = create new localization
    strapi.findByPathSlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      frontmatter: {
        title: 'Sobre',
        pathSlug: 'sobre-nosotros',
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
      pathSlug: 'sobre-nosotros',
      locale: 'es'
    }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existingLocale)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      frontmatter: {
        title: 'Sobre',
        pathSlug: 'sobre-nosotros',
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
    strapi.findByPathSlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'some-page',
      locale: undefined,
      frontmatter: { title: 'Some', pathSlug: 'some-page' }
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

    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'foundation-pages',
      'some-page',
      'en'
    )
  })

  it('dry run increments created counter without calling createLocalization', async () => {
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(undefined)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'sobre-nosotros',
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
      pathSlug: 'sobre-nosotros',
      locale: 'es'
    }
    const strapi = createMockStrapi()
    strapi.findByPathSlug.mockResolvedValue(existingLocale)
    const ctx: SyncContext = { contentTypes, strapi }
    const results = createResults()
    const mdx = createMdxFile({
      pathSlug: 'sobre-nosotros',
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
// Uses merged fetch (locale=all + per-locale), groups by documentId,
// deletes non-default locales first, then document root.
describe('deleteOrphanedEntries', () => {
  /**
   * Helper: mock getAllEntries to return entries from locale=all,
   * then per-locale queries. The first call is locale=all.
   */
  function mockMergedFetch(
    strapi: ReturnType<typeof createMockStrapi>,
    allEntries: StrapiEntry[],
    perLocaleEntries: StrapiEntry[][] = []
  ) {
    // First call: locale=all
    strapi.getAllEntries.mockResolvedValueOnce(allEntries)
    // Subsequent calls: one per locale from getLocalesToCheck
    for (const batch of perLocaleEntries) {
      strapi.getAllEntries.mockResolvedValueOnce(batch)
    }
    // Default empty for any additional calls
    strapi.getAllEntries.mockResolvedValue([])
  }

  it('deletes entries that have no matching MDX file', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(
      strapi,
      [{ documentId: '1', pathSlug: 'orphan', locale: 'en' }],
      [[{ documentId: '1', pathSlug: 'orphan', locale: 'en' }]]
    )
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
    expect(strapi.deleteEntry).toHaveBeenCalledWith('foundation-pages', '1')
    expect(results.deleted).toBe(1)
  })

  it('skips entries that have matching MDX file', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(true)
    const strapi = createMockStrapi()
    mockMergedFetch(
      strapi,
      [{ documentId: '2', pathSlug: 'kept', locale: 'en' }],
      [[{ documentId: '2', pathSlug: 'kept', locale: 'en' }]]
    )
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
    expect(strapi.deleteEntry).not.toHaveBeenCalled()
    expect(results.deleted).toBe(0)
  })

  it('deduplicates entries from locale=all and per-locale queries', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    const entry = { documentId: '1', pathSlug: 'orphan', locale: 'en' }
    // Same entry returned by both locale=all and locale=en
    mockMergedFetch(strapi, [entry], [[entry]])
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

    // Should only delete once despite appearing in both queries
    expect(strapi.deleteLocalization).toHaveBeenCalledTimes(1)
    expect(results.deleted).toBe(1)
  })

  it('processes multiple locales and groups by documentId', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    // locale=all returns both locales of the same document
    mockMergedFetch(
      strapi,
      [
        { documentId: '1', pathSlug: 'orphan', locale: 'en' },
        { documentId: '1', pathSlug: 'huerfano', locale: 'es' }
      ],
      [
        [{ documentId: '1', pathSlug: 'orphan', locale: 'en' }],
        [{ documentId: '1', pathSlug: 'huerfano', locale: 'es' }]
      ]
    )
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

    // Both locale variants deleted + document root
    expect(strapi.deleteLocalization).toHaveBeenCalledTimes(2)
    expect(strapi.deleteEntry).toHaveBeenCalledWith('foundation-pages', '1')
    expect(results.deleted).toBe(2)
  })

  it('deletes non-default locales before default locale', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' },
      { documentId: '1', pathSlug: 'huerfano', locale: 'es' }
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

    // 'es' should be deleted before 'en'
    const calls = strapi.deleteLocalization.mock.calls
    expect(calls[0]).toEqual(['foundation-pages', '1', 'es'])
    expect(calls[1]).toEqual(['foundation-pages', '1', 'en'])
  })

  // Entry.locale might differ from the query locale if Strapi returns mixed results.
  // We use the actual entry locale for the hasMdxFile check and delete call.
  it('uses entry.locale when available instead of fallback locale', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    // locale=all returns entry with locale 'fr'
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'test', locale: 'fr' }
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

  it('calls deleteEntry to clean up document root after locale deletion', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' }
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

    expect(strapi.deleteEntry).toHaveBeenCalledWith('foundation-pages', '1')
  })

  it('tolerates 404 on deleteLocalization (cascaded delete)', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' },
      { documentId: '1', pathSlug: 'huerfano', locale: 'es' }
    ])
    // 'es' deletion succeeds, 'en' returns 404 (cascaded)
    strapi.deleteLocalization
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Strapi API error (404): Not Found'))
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

    // 404 counts as success, not error
    expect(results.deleted).toBe(2)
    expect(results.errors).toBe(0)
  })

  it('tolerates 404 on deleteEntry (document already gone)', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' }
    ])
    strapi.deleteEntry.mockRejectedValue(new Error('404 not found'))
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

    // Locale deletion succeeded, document root 404 is tolerated
    expect(results.deleted).toBe(1)
    expect(results.errors).toBe(0)
  })

  it('gracefully handles locale=all query failure', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    // locale=all fails, per-locale still works
    strapi.getAllEntries
      .mockRejectedValueOnce(new Error('locale=all not supported'))
      .mockResolvedValueOnce([
        { documentId: '1', pathSlug: 'orphan', locale: 'en' }
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

    // Falls through to per-locale query and still deletes
    expect(strapi.deleteLocalization).toHaveBeenCalledWith(
      'foundation-pages',
      '1',
      'en'
    )
    expect(results.deleted).toBe(1)
  })

  it('dry run increments deleted counter without calling deleteLocalization', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' }
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
    expect(strapi.deleteEntry).not.toHaveBeenCalled()
    expect(results.deleted).toBe(1)
  })

  it('dry run counts all locale variants of a grouped document', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan', locale: 'en' },
      { documentId: '1', pathSlug: 'huerfano', locale: 'es' }
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
    expect(results.deleted).toBe(2)
  })

  // Delete errors shouldn't crash the whole sync — log and continue
  it('increments errors counter when delete fails with non-404 error', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'failing', locale: 'en' }
    ])
    strapi.deleteLocalization.mockRejectedValue(
      new Error('Internal Server Error')
    )
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

  it('does not call deleteEntry when no locale deletions succeeded', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'failing', locale: 'en' }
    ])
    strapi.deleteLocalization.mockRejectedValue(
      new Error('Internal Server Error')
    )
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

    // Should not attempt document root cleanup if no locales were deleted
    expect(strapi.deleteEntry).not.toHaveBeenCalled()
  })

  it('uses locale=all query in addition to per-locale queries', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en', 'es'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [], [[], []])
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

    // First call is locale=all, then one per locale
    expect(strapi.getAllEntries).toHaveBeenCalledWith('foundation-pages', 'all')
    expect(strapi.getAllEntries).toHaveBeenCalledWith('foundation-pages', 'en')
    expect(strapi.getAllEntries).toHaveBeenCalledWith('foundation-pages', 'es')
  })

  it('handles multiple orphaned documents independently', async () => {
    mockedGetLocalesToCheck.mockReturnValue(['en'])
    mockedHasMdxFile.mockReturnValue(false)
    const strapi = createMockStrapi()
    mockMergedFetch(strapi, [
      { documentId: '1', pathSlug: 'orphan-a', locale: 'en' },
      { documentId: '2', pathSlug: 'orphan-b', locale: 'en' }
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

    expect(strapi.deleteLocalization).toHaveBeenCalledTimes(2)
    expect(strapi.deleteEntry).toHaveBeenCalledTimes(2)
    expect(strapi.deleteEntry).toHaveBeenCalledWith('foundation-pages', '1')
    expect(strapi.deleteEntry).toHaveBeenCalledWith('foundation-pages', '2')
    expect(results.deleted).toBe(2)
  })
})

// Handles locale MDX files that weren't matched during the main English sync pass.
// This can happen when the English file doesn't exist in MDX but does exist in Strapi.
describe('syncUnmatchedLocales', () => {
  it('creates localization when match found in Strapi', async () => {
    const localeMdx = createMdxFile({
      pathSlug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us',
      frontmatter: {
        title: 'Sobre',
        pathSlug: 'sobre-nosotros',
        localizes: 'about-us'
      }
    })
    // Simulate English entry existing in Strapi (but not in MDX)
    const allStrapiEntries: StrapiEntry[] = [
      { documentId: 'en-1', pathSlug: 'about-us', locale: 'en' }
    ]
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue(allStrapiEntries)
    strapi.findByPathSlug.mockResolvedValue(undefined)
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
      pathSlug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', pathSlug: 'about-us', locale: 'en' }
    ])
    strapi.findByPathSlug.mockResolvedValue(undefined)
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
      pathSlug: 'sobre-nosotros',
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
      pathSlug: 'sobre-nosotros',
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
      pathSlug: 'some-page',
      locale: undefined,
      isLocalization: true,
      localizes: 'english-page'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', pathSlug: 'english-page', locale: 'en' }
    ])
    strapi.findByPathSlug.mockResolvedValue(undefined)
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
      pathSlug: 'sobre-nosotros',
      locale: 'es',
      isLocalization: true,
      localizes: 'about-us'
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', pathSlug: 'about-us', locale: 'en' }
    ])
    strapi.findByPathSlug.mockResolvedValue(undefined)
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
      pathSlug: 'orphan-page',
      locale: 'es',
      isLocalization: true,
      localizes: null
    })
    const strapi = createMockStrapi()
    strapi.getAllEntries.mockResolvedValue([
      { documentId: 'en-1', pathSlug: 'about-us', locale: 'en' }
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
