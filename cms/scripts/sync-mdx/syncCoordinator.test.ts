import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContentTypes } from './config'
import type { SyncContext } from './types'
import { createMdxFile } from './test-utils'

vi.mock('./scan', () => ({
  scanMDXFiles: vi.fn((contentType: keyof ContentTypes) => [
    createMdxFile({ pathSlug: `${contentType}-entry` })
  ])
}))

vi.mock('./validateFrontmatter', () => ({
  validateMdxFiles: vi.fn((_config: unknown, mdxFiles: unknown[]) => ({
    valid: mdxFiles,
    invalid: []
  }))
}))

vi.mock('./localeMatch', () => ({
  buildMdxSlugsByLocale: vi.fn(() => new Map()),
  findMatchingLocales: vi.fn(() => [])
}))

const syncOrder: string[] = []

vi.mock('./syncOperations', () => ({
  syncEnglishEntry: vi.fn(
    async (contentType: keyof ContentTypes, ..._rest: unknown[]) => {
      // profiles resolves slower than everything else — if syncAll still
      // ran every content type concurrently, a "dependent" type would
      // record its entry before profiles finishes.
      if (contentType === 'profiles') {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      syncOrder.push(contentType)
      return { documentId: `${contentType}-doc`, pathSlug: 'x' }
    }
  ),
  syncLocaleEntry: vi.fn(),
  syncUnmatchedLocales: vi.fn().mockResolvedValue(undefined),
  deleteOrphanedEntries: vi.fn().mockResolvedValue(undefined)
}))

import { syncAll } from './syncCoordinator'

function fakeContentTypes(): ContentTypes {
  const config = { dir: '/fake', apiId: 'fake', buildPayload: vi.fn() }
  return {
    profiles: { ...config, apiId: 'profile-pages' },
    faqs: { ...config, apiId: 'faqs' },
    reports: { ...config, apiId: 'reports' },
    'grant-pages': { ...config, apiId: 'grant-pages' },
    'grant-overview-pages': { ...config, apiId: 'grant-overview-pages' },
    'foundation-pages': { ...config, apiId: 'foundation-pages' },
    'summit-pages': { ...config, apiId: 'summit-pages' },
    'foundation-blog-posts': { ...config, apiId: 'foundation-blog-posts' }
  } as unknown as ContentTypes
}

describe('syncAll', () => {
  beforeEach(() => {
    syncOrder.length = 0
  })

  it('finishes syncing profiles before any other content type, even though profiles resolves slower', async () => {
    const ctx: SyncContext = {
      contentTypes: fakeContentTypes(),
      strapi: {} as SyncContext['strapi']
    }

    const results = await syncAll(ctx, false)

    expect(syncOrder[0]).toBe('profiles')
    expect(syncOrder).toHaveLength(8)
    expect(results.errors).toBe(0)
  })
})
