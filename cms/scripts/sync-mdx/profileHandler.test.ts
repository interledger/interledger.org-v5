import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import type { StrapiClient } from './strapiClient'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock StrapiClient with a controllable findByPathSlug. */
function createMockStrapi(
  entries: Record<string, { documentId: string; locale: string }>
): StrapiClient {
  return {
    findByPathSlug: vi.fn(
      async (
        _apiId: string,
        pathSlug: string,
        locale?: string
      ): Promise<{ documentId: string; pathSlug: string } | undefined> => {
        const key = `${locale}:${pathSlug}`
        const entry = entries[key]
        return entry ? { documentId: entry.documentId, pathSlug } : undefined
      }
    ),
    // Unused methods — stub to satisfy the interface
    request: vi.fn(),
    getAllEntries: vi.fn(),
    findUploadByUrl: vi.fn(),
    createLocalization: vi.fn(),
    updateLocalization: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    deleteLocalization: vi.fn()
  } as unknown as StrapiClient
}

// ---------------------------------------------------------------------------
// createRelationResolver
// ---------------------------------------------------------------------------

describe('createRelationResolver', () => {
  let createRelationResolver: typeof import('./profileHandler').createRelationResolver

  beforeEach(async () => {
    const mod = await import('./profileHandler')
    createRelationResolver = mod.createRelationResolver
  })

  it('resolves pathSlug in the target locale', async () => {
    const strapi = createMockStrapi({
      'es:alice': { documentId: 'doc-es-alice', locale: 'es' }
    })
    const resolve = createRelationResolver(strapi, 'es')

    const result = await resolve('profile-pages', 'alice')

    expect(result).toEqual({ documentId: 'doc-es-alice' })
    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'profile-pages',
      'alice',
      'es'
    )
  })

  it('falls back to en when not found in target locale', async () => {
    const strapi = createMockStrapi({
      'en:alice': { documentId: 'doc-en-alice', locale: 'en' }
    })
    const resolve = createRelationResolver(strapi, 'es')

    const result = await resolve('profile-pages', 'alice')

    expect(result).toEqual({ documentId: 'doc-en-alice' })
    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'profile-pages',
      'alice',
      'es'
    )
    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'profile-pages',
      'alice',
      'en'
    )
  })

  it('throws UNRESOLVED_RELATION when not found in any locale', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(strapi, 'es')

    await expect(resolve('profile-pages', 'ghost')).rejects.toThrow(
      MdxParserError
    )
    await expect(resolve('profile-pages', 'ghost')).rejects.toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })

  it('does not fall back when locale is already en', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(strapi, 'en')

    await expect(resolve('profile-pages', 'ghost')).rejects.toThrow(
      MdxParserError
    )
    // Should only call once (no fallback to same locale)
    expect(strapi.findByPathSlug).toHaveBeenCalledTimes(1)
  })

  it('dry-run: resolves with a placeholder when the pathSlug would be created by this same run', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(
      strapi,
      'en',
      true,
      new Set(['grant/fellowship/lawil-karama'])
    )

    const result = await resolve(
      'profile-pages',
      'grant/fellowship/lawil-karama'
    )

    expect(result.documentId).toBeTruthy()
  })

  it('dry-run: still throws UNRESOLVED_RELATION when the pathSlug is not in dryRunPathSlugs either', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(
      strapi,
      'en',
      true,
      new Set(['some/other-profile'])
    )

    await expect(resolve('profile-pages', 'ghost')).rejects.toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })

  it('non-dry-run: ignores dryRunPathSlugs and throws for an unresolved relation', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(
      strapi,
      'en',
      false,
      new Set(['grant/fellowship/lawil-karama'])
    )

    await expect(
      resolve('profile-pages', 'grant/fellowship/lawil-karama')
    ).rejects.toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers for handler tests
// ---------------------------------------------------------------------------

/** Mock resolver that returns a predictable documentId from the pathSlug. */
function mockResolver(
  knownSlugs: Record<string, string> = {}
): (apiId: string, pathSlug: string) => Promise<{ documentId: string }> {
  return async (_apiId: string, pathSlug: string) => {
    const docId = knownSlugs[pathSlug]
    if (!docId) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message: `Slug "${pathSlug}" not found.`
      })
    }
    return { documentId: docId }
  }
}

function ctxWith(slugs: Record<string, string>, locale = 'en'): ParserContext {
  return { locale, resolveRelation: mockResolver(slugs) }
}

// ---------------------------------------------------------------------------
// ProfileCard handler (via parseMdxToBlocks)
// ---------------------------------------------------------------------------

// Import side-effects: registers ProfileCard + ProfileGrid handlers
import './profileHandler'

describe('ProfileCard handler', () => {
  it('parses <ProfileCard pathSlug="alice" /> into ProfileBlock', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileCard pathSlug="alice" />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile',
        profile: { connect: [{ documentId: 'doc-alice' }] }
      }
    ])
  })

  it('returns MISSING_REQUIRED_PROP when pathSlug is missing', async () => {
    const result = await parseMdxToBlocks('<ProfileCard />', ctxWith({}))
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })
})

// ---------------------------------------------------------------------------
// ProfileGrid handler (via parseMdxToBlocks)
// ---------------------------------------------------------------------------

describe('ProfileGrid handler', () => {
  it('parses <ProfileGrid> with heading and pathSlugs', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid heading="Our Team" pathSlugs={["alice","bob"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile-grid',
        heading: 'Our Team',
        profiles: {
          connect: [{ documentId: 'doc-alice' }, { documentId: 'doc-bob' }]
        }
      }
    ])
  })

  it('preserves pathSlug order in resolved profiles', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid pathSlugs={["bob","alice"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' })
    )

    expect(blocks[0]).toMatchObject({
      profiles: {
        connect: [{ documentId: 'doc-bob' }, { documentId: 'doc-alice' }]
      }
    })
  })

  it('heading is optional', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid pathSlugs={["alice"]} />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).not.toHaveProperty('heading')
  })

  it('returns MISSING_REQUIRED_PROP when both pathSlugs and category are missing', async () => {
    const result = await parseMdxToBlocks(
      '<ProfileGrid heading="Team" />',
      ctxWith({})
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('parses <ProfileGrid> with category instead of pathSlugs', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid heading="2026 Fellows" category="Fellows 2026" />',
      ctxWith({})
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile-grid',
        heading: '2026 Fellows',
        category: 'Fellows 2026'
      }
    ])
  })

  it('parses <ProfileGrid> with category and no heading', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid category="Fellows 2026" />',
      ctxWith({})
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.profile-grid',
      category: 'Fellows 2026'
    })
    expect(blocks[0]).not.toHaveProperty('heading')
  })

  it('returns UNRESOLVED_RELATION when any pathSlug is unresolved', async () => {
    const result = await parseMdxToBlocks(
      '<ProfileGrid pathSlugs={["alice","ghost"]} />',
      ctxWith({ alice: 'doc-alice' })
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })
})

// ---------------------------------------------------------------------------
// Locale import
// ---------------------------------------------------------------------------

describe('ProfileCard handler (locale import)', () => {
  it('resolves ProfileCard pathSlug in es locale via resolveRelation', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileCard pathSlug="alice" />',
      ctxWith({ alice: 'doc-alice' }, 'es')
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile',
        profile: { connect: [{ documentId: 'doc-alice' }] }
      }
    ])
  })

  it('resolves ProfileGrid pathSlugs in es locale', async () => {
    const blocks = await parseMdxToBlocks(
      '<ProfileGrid heading="Equipo" pathSlugs={["alice","bob"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' }, 'es')
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.profile-grid',
      heading: 'Equipo',
      profiles: {
        connect: [{ documentId: 'doc-alice' }, { documentId: 'doc-bob' }]
      }
    })
  })

  it('uses locale-first then en fallback via createRelationResolver', async () => {
    const strapi = createMockStrapi({
      'en:alice': { documentId: 'doc-en-alice', locale: 'en' }
    })
    const { createRelationResolver } = await import('./profileHandler')
    const resolve = createRelationResolver(strapi, 'es')
    const esCtx: ParserContext = { locale: 'es', resolveRelation: resolve }

    const blocks = await parseMdxToBlocks(
      '<ProfileCard pathSlug="alice" />',
      esCtx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile',
        profile: { connect: [{ documentId: 'doc-en-alice' }] }
      }
    ])
    // Tried es first, then fell back to en
    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'profile-pages',
      'alice',
      'es'
    )
    expect(strapi.findByPathSlug).toHaveBeenCalledWith(
      'profile-pages',
      'alice',
      'en'
    )
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + JSX
// ---------------------------------------------------------------------------

describe('mixed markdown and JSX content', () => {
  it('produces blocks in document order', async () => {
    const mdx = [
      'Here are our profiles:',
      '',
      '<ProfileCard pathSlug="alice" />',
      '',
      'More text below.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith({ alice: 'doc-alice' }))

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Here are our profiles:'
    })
    expect(blocks[1]).toEqual({
      __component: 'blocks.profile',
      profile: { connect: [{ documentId: 'doc-alice' }] }
    })
    expect(blocks[2]).toEqual({
      __component: 'blocks.paragraph',
      content: 'More text below.'
    })
  })
})
