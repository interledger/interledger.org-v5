import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPageLifecycle,
  defaultLang,
  generateMDX,
  isCodeSyncRequest,
  readLocaleFromUpdateEvent,
  resolvePageFilepath,
  resolveUpdateTarget
} from '@/utils'

const testConfig = {
  contentTypeUid: 'api::foundation-page.foundation-page' as const,
  outputDir: 'src/content/foundation-pages',
  populate: {
    hero: { populate: '*' as const },
    content: { populate: '*' as const }
  }
}

describe('generateMDX — clears deleted Strapi-managed fields', () => {
  it('removes heroImage from frontmatter when media is deleted in Strapi', async () => {
    const page = {
      id: 1,
      documentId: 'doc1',
      title: 'Test Page',
      pathSlug: 'test',
      locale: 'en',
      description: 'Test description',
      hero: {
        title: 'Hero Title',
        description: undefined,
        media: undefined
      }
    }
    const preservedFields = {
      heroImage: 'https://example.com/old-image.jpg',
      heroTitle: 'Preserved Title'
    }

    const result = await generateMDX(testConfig, page, preservedFields)

    expect(result).not.toContain('heroImage')
  })

  it('keeps heroImage in frontmatter when media is present', async () => {
    const page = {
      id: 1,
      documentId: 'doc1',
      title: 'Test Page',
      pathSlug: 'test',
      locale: 'en',
      description: 'Test description',
      hero: {
        title: 'Hero Title',
        media: { image: { url: 'https://example.com/image.jpg' } }
      }
    }

    const result = await generateMDX(testConfig, page)

    expect(result).toContain('heroImage')
    expect(result).toContain('https://example.com/image.jpg')
  })
})

describe('generateMDX — required field validation', () => {
  const base = {
    id: 1,
    documentId: 'doc1',
    title: 'Test Page',
    pathSlug: 'test',
    locale: 'en',
    description: 'Test description'
  }

  it('throws when description is missing', async () => {
    await expect(
      generateMDX(testConfig, { ...base, description: undefined })
    ).rejects.toThrow('Page is missing a required description')
  })

  it('throws when description is blank', async () => {
    await expect(
      generateMDX(testConfig, { ...base, description: '   ' })
    ).rejects.toThrow('Page is missing a required description')
  })

  it('throws when hero is present but title is empty', async () => {
    await expect(
      generateMDX(testConfig, { ...base, hero: { title: '' } })
    ).rejects.toThrow('Hero is missing required title')
  })

  it('throws when a hero CTA is missing text', async () => {
    await expect(
      generateMDX(testConfig, {
        ...base,
        hero: {
          title: 'Hero',
          hero_call_to_action: { text: '', link: '/about' }
        }
      })
    ).rejects.toThrow('Hero CTA is missing required text')
  })

  it('throws when a hero CTA is missing link', async () => {
    await expect(
      generateMDX(testConfig, {
        ...base,
        hero: {
          title: 'Hero',
          hero_call_to_action: { text: 'Learn more', link: '' }
        }
      })
    ).rejects.toThrow('Hero CTA is missing required link')
  })

  it('writes title/description/locale without hero fields when hero is absent', async () => {
    const result = await generateMDX(testConfig, base)

    expect(result).toContain("title: 'Test Page'")
    expect(result).toContain("description: 'Test description'")
    expect(result).toContain("locale: 'en'")
    expect(result).not.toContain('heroTitle')
    expect(result).not.toContain('heroImage')
  })

  it('clears stale hero fields preserved from MDX when the page has no hero', async () => {
    const result = await generateMDX(testConfig, base, {
      heroTitle: 'Stale',
      heroImage: '/old.jpg',
      heroImageMobile: '/old-mobile.jpg',
      heroCtas: [{ text: 'Go', link: '/' }]
    })

    expect(result).not.toContain('heroTitle')
    expect(result).not.toContain('heroImage')
    expect(result).not.toContain('heroImageMobile')
    expect(result).not.toContain('heroCtas')
  })
})

describe('resolvePageFilepath', () => {
  const outputDir = path.join('/repo', 'src', 'content', 'foundation-pages')

  it('keeps English nested pages under slug parent directories', () => {
    expect(
      resolvePageFilepath(
        outputDir,
        { pathSlug: 'grant/grant-web' },
        defaultLang
      )
    ).toBe(path.join(outputDir, 'grant', 'grant-web.mdx'))
  })

  it('writes localized nested pages under the collection-level locale directory', () => {
    expect(
      resolvePageFilepath(outputDir, { pathSlug: 'grant/grant-web' }, 'es')
    ).toBe(path.join(outputDir, 'es', 'grant', 'grant-web.mdx'))
  })

  it('writes localized top-level pages under the collection-level locale directory', () => {
    expect(resolvePageFilepath(outputDir, { pathSlug: 'home' }, 'es')).toBe(
      path.join(outputDir, 'es', 'home.mdx')
    )
  })

  // Without this, a caller that forgets to resolve the English slug first
  // writes es/sobre-nosotros.mdx beside es/about-us.mdx.
  it('names a localized page after the entry it localizes', () => {
    expect(
      resolvePageFilepath(
        outputDir,
        { pathSlug: 'subvenciones/beca' },
        'es',
        'grant/fellowship'
      )
    ).toBe(path.join(outputDir, 'es', 'grant', 'fellowship.mdx'))
  })

  it('ignores the English slug for an English page', () => {
    expect(
      resolvePageFilepath(
        outputDir,
        { pathSlug: 'about-us' },
        defaultLang,
        'something-else'
      )
    ).toBe(path.join(outputDir, 'about-us.mdx'))
  })

  it('falls back to the page slug when no English counterpart is known', () => {
    expect(
      resolvePageFilepath(outputDir, { pathSlug: 'sobre-nosotros' }, 'es', null)
    ).toBe(path.join(outputDir, 'es', 'sobre-nosotros.mdx'))
  })
})

describe('readLocaleFromUpdateEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to en when locale is absent', () => {
    expect(readLocaleFromUpdateEvent({ params: { documentId: 'x' } })).toBe(
      defaultLang
    )
  })

  it('uses params.locale', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { locale: 'es', documentId: 'x' }
      })
    ).toBe('es')
  })

  it('uses params.data.locale when params.locale is missing', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { data: { documentId: 'x', locale: 'fr' } }
      })
    ).toBe('fr')
  })

  it('falls back to locale on params.where (document-service update filter)', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { where: { locale: 'de' }, documentId: 'x' }
      })
    ).toBe('de')
  })
})

describe('isCodeSyncRequest', () => {
  const SKIP_HEADER = { 'x-skip-mdx-export': 'true' }

  function stubRequest(strategy: string | undefined, headers = {}) {
    vi.stubGlobal('strapi', {
      requestContext: {
        get: () => ({
          request: { headers },
          state: strategy ? { auth: { strategy: { name: strategy } } } : {}
        })
      }
    })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a content API token request with the sync header', () => {
    stubRequest('content-api-token', SKIP_HEADER)
    expect(isCodeSyncRequest()).toBe(true)
  })

  it('refuses an admin session even with the sync header', () => {
    stubRequest('admin', SKIP_HEADER)
    expect(isCodeSyncRequest()).toBe(false)
  })

  it('refuses an admin token even with the sync header', () => {
    stubRequest('admin-token', SKIP_HEADER)
    expect(isCodeSyncRequest()).toBe(false)
  })

  // Strapi 5.41 called the content API token strategy `api-token`.
  it('refuses the strategy name from before Strapi 5.57', () => {
    stubRequest('api-token', SKIP_HEADER)
    expect(isCodeSyncRequest()).toBe(false)
  })

  it('refuses a content API token request without the sync header', () => {
    stubRequest('content-api-token')
    expect(isCodeSyncRequest()).toBe(false)
  })

  it('refuses an unauthenticated request with the sync header', () => {
    stubRequest(undefined, SKIP_HEADER)
    expect(isCodeSyncRequest()).toBe(false)
  })

  it('refuses when there is no active request', () => {
    vi.stubGlobal('strapi', {
      requestContext: {
        get: () => {
          throw new Error('no context')
        }
      }
    })
    expect(isCodeSyncRequest()).toBe(false)
  })
})

// Strapi 5.57 strips `documentId` from `data` before the DB update, so a
// lifecycle event carries only `where: { id }` (INTORG-1422).
describe('resolveUpdateTarget', () => {
  const uid = 'api::foundation-page.foundation-page' as const

  function stubRowLookup(
    findOne: (args: { where: { id: unknown } }) => Promise<unknown>
  ) {
    const query = vi.fn(() => ({ findOne: vi.fn(findOne) }))
    vi.stubGlobal('strapi', { db: { query } })
    return query
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the documentId the event names, without a lookup', async () => {
    const query = stubRowLookup(async () => null)

    const target = await resolveUpdateTarget(
      { params: { documentId: 'doc-1', locale: 'es' } },
      uid
    )

    expect(target).toEqual({ documentId: 'doc-1', locale: 'es' })
    expect(query).not.toHaveBeenCalled()
  })

  it('reads documentId and locale off the row when only where.id is set', async () => {
    stubRowLookup(async ({ where }) =>
      where.id === 7 ? { documentId: 'doc-1', locale: 'es' } : null
    )

    const target = await resolveUpdateTarget(
      { params: { where: { id: 7 }, data: {} } },
      uid
    )

    expect(target).toEqual({ documentId: 'doc-1', locale: 'es' })
  })

  it('falls back to the default locale when the row has none', async () => {
    stubRowLookup(async () => ({ documentId: 'doc-1', locale: null }))

    const target = await resolveUpdateTarget(
      { params: { where: { id: 7 } } },
      uid
    )

    expect(target).toEqual({ documentId: 'doc-1', locale: defaultLang })
  })

  it('returns null when the row is gone', async () => {
    stubRowLookup(async () => null)

    expect(
      await resolveUpdateTarget({ params: { where: { id: 7 } } }, uid)
    ).toBeNull()
  })

  it('returns null when the event identifies no row at all', async () => {
    const query = stubRowLookup(async () => null)

    expect(await resolveUpdateTarget({ params: { data: {} } }, uid)).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('returns the lookup failure as an Error', async () => {
    stubRowLookup(async () => {
      throw new Error('db down')
    })

    const target = await resolveUpdateTarget(
      { params: { where: { id: 7 } } },
      uid
    )

    expect(target).toBeInstanceOf(Error)
    expect((target as Error).message).toContain('db down')
  })
})

describe('createPageLifecycle beforeUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Without the stashed slug, a rename leaves the old MDX file behind as a
  // duplicate of the new one.
  it('stashes the published slug when the event carries only where.id', async () => {
    const findPublished = vi.fn(async () => ({ pathSlug: '/old-slug/' }))
    vi.stubGlobal('strapi', {
      requestContext: { get: () => ({ request: { headers: {} } }) },
      db: {
        query: () => ({
          findOne: async () => ({ documentId: 'doc-1', locale: 'es' })
        })
      },
      documents: () => ({ findOne: findPublished })
    })
    const lifecycle = createPageLifecycle(testConfig)
    const event = {
      params: { where: { id: 7 }, data: { pathSlug: '/new-slug/' } },
      state: {} as { oldPathSlug?: string; locale?: string }
    }

    await lifecycle.beforeUpdate(event)

    expect(findPublished).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1', locale: 'es' })
    )
    expect(event.state).toEqual({ oldPathSlug: '/old-slug/', locale: 'es' })
  })
})
