import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import type { StrapiClient } from './strapiClient'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock StrapiClient with a controllable findBySlug. */
function createMockStrapi(
  entries: Record<string, { documentId: string; locale: string }>
): StrapiClient {
  return {
    findBySlug: vi.fn(
      async (
        _apiId: string,
        slug: string,
        locale?: string
      ): Promise<{ documentId: string; slug: string } | undefined> => {
        const key = `${locale}:${slug}`
        const entry = entries[key]
        return entry ? { documentId: entry.documentId, slug } : undefined
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
  let createRelationResolver: typeof import('./ambassadorHandler').createRelationResolver

  beforeEach(async () => {
    const mod = await import('./ambassadorHandler')
    createRelationResolver = mod.createRelationResolver
  })

  it('resolves slug in the target locale', async () => {
    const strapi = createMockStrapi({
      'es:alice': { documentId: 'doc-es-alice', locale: 'es' }
    })
    const resolve = createRelationResolver(strapi, 'es')

    const result = await resolve('ambassadors', 'alice')

    expect(result).toEqual({ documentId: 'doc-es-alice' })
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice', 'es')
  })

  it('falls back to en when not found in target locale', async () => {
    const strapi = createMockStrapi({
      'en:alice': { documentId: 'doc-en-alice', locale: 'en' }
    })
    const resolve = createRelationResolver(strapi, 'es')

    const result = await resolve('ambassadors', 'alice')

    expect(result).toEqual({ documentId: 'doc-en-alice' })
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice', 'es')
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice', 'en')
  })

  it('throws UNRESOLVED_RELATION when not found in any locale', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(strapi, 'es')

    await expect(resolve('ambassadors', 'ghost')).rejects.toThrow(
      MdxParserError
    )
    await expect(resolve('ambassadors', 'ghost')).rejects.toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })

  it('does not fall back when locale is already en', async () => {
    const strapi = createMockStrapi({})
    const resolve = createRelationResolver(strapi, 'en')

    await expect(resolve('ambassadors', 'ghost')).rejects.toThrow(
      MdxParserError
    )
    // Should only call once (no fallback to same locale)
    expect(strapi.findBySlug).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Helpers for handler tests
// ---------------------------------------------------------------------------

/** Mock resolver that returns a predictable documentId from the slug. */
function mockResolver(
  knownSlugs: Record<string, string> = {}
): (apiId: string, slug: string) => Promise<{ documentId: string }> {
  return async (_apiId: string, slug: string) => {
    const docId = knownSlugs[slug]
    if (!docId) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message: `Slug "${slug}" not found.`
      })
    }
    return { documentId: docId }
  }
}

function ctxWith(slugs: Record<string, string>, locale = 'en'): ParserContext {
  return { locale, resolveRelation: mockResolver(slugs) }
}

// ---------------------------------------------------------------------------
// Ambassador handler (via parseMdxToBlocks)
// ---------------------------------------------------------------------------

// Import side-effects: registers Ambassador + AmbassadorGrid handlers
import './ambassadorHandler'

describe('Ambassador handler', () => {
  it('parses <Ambassador slug="alice" /> into AmbassadorBlock', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.ambassador',
        ambassador: { connect: [{ documentId: 'doc-alice' }] }
      }
    ])
  })

  it('parses showLinks={false}', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" showLinks={false} />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).toMatchObject({ showLinks: false })
  })

  it('parses showLinks={true}', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" showLinks={true} />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).toMatchObject({ showLinks: true })
  })

  it('parses valueless showLinks as true', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" showLinks />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).toMatchObject({ showLinks: true })
  })

  it('omits showLinks when not specified', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).not.toHaveProperty('showLinks')
  })

  it('throws MISSING_REQUIRED_PROP when slug is missing', async () => {
    await expect(
      parseMdxToBlocks('<Ambassador />', ctxWith({}))
    ).rejects.toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })
})

// ---------------------------------------------------------------------------
// AmbassadorGrid handler (via parseMdxToBlocks)
// ---------------------------------------------------------------------------

describe('AmbassadorGrid handler', () => {
  it('parses <AmbassadorGrid> with heading and slugs', async () => {
    const blocks = await parseMdxToBlocks(
      '<AmbassadorGrid heading="Our Team" slugs={["alice","bob"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.ambassadors-grid',
        heading: 'Our Team',
        ambassadors: {
          connect: [{ documentId: 'doc-alice' }, { documentId: 'doc-bob' }]
        }
      }
    ])
  })

  it('preserves slug order in resolved ambassadors', async () => {
    const blocks = await parseMdxToBlocks(
      '<AmbassadorGrid slugs={["bob","alice"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' })
    )

    expect(blocks[0]).toMatchObject({
      ambassadors: {
        connect: [{ documentId: 'doc-bob' }, { documentId: 'doc-alice' }]
      }
    })
  })

  it('heading is optional', async () => {
    const blocks = await parseMdxToBlocks(
      '<AmbassadorGrid slugs={["alice"]} />',
      ctxWith({ alice: 'doc-alice' })
    )

    expect(blocks[0]).not.toHaveProperty('heading')
  })

  it('throws MISSING_REQUIRED_PROP when slugs is missing', async () => {
    await expect(
      parseMdxToBlocks('<AmbassadorGrid heading="Team" />', ctxWith({}))
    ).rejects.toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('throws UNRESOLVED_RELATION when any slug is unresolved', async () => {
    await expect(
      parseMdxToBlocks(
        '<AmbassadorGrid slugs={["alice","ghost"]} />',
        ctxWith({ alice: 'doc-alice' })
      )
    ).rejects.toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })
})

// ---------------------------------------------------------------------------
// Locale import
// ---------------------------------------------------------------------------

describe('Ambassador handler (locale import)', () => {
  it('resolves Ambassador slug in es locale via resolveRelation', async () => {
    const blocks = await parseMdxToBlocks(
      '<Ambassador slug="alice" />',
      ctxWith({ alice: 'doc-alice' }, 'es')
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.ambassador',
        ambassador: { connect: [{ documentId: 'doc-alice' }] }
      }
    ])
  })

  it('resolves AmbassadorGrid slugs in es locale', async () => {
    const blocks = await parseMdxToBlocks(
      '<AmbassadorGrid heading="Equipo" slugs={["alice","bob"]} />',
      ctxWith({ alice: 'doc-alice', bob: 'doc-bob' }, 'es')
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.ambassadors-grid',
      heading: 'Equipo',
      ambassadors: {
        connect: [{ documentId: 'doc-alice' }, { documentId: 'doc-bob' }]
      }
    })
  })

  it('uses locale-first then en fallback via createRelationResolver', async () => {
    const strapi = createMockStrapi({
      'en:alice': { documentId: 'doc-en-alice', locale: 'en' }
    })
    const { createRelationResolver } = await import('./ambassadorHandler')
    const resolve = createRelationResolver(strapi, 'es')
    const esCtx: ParserContext = { locale: 'es', resolveRelation: resolve }

    const blocks = await parseMdxToBlocks('<Ambassador slug="alice" />', esCtx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.ambassador',
        ambassador: { connect: [{ documentId: 'doc-en-alice' }] }
      }
    ])
    // Tried es first, then fell back to en
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice', 'es')
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice', 'en')
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + JSX
// ---------------------------------------------------------------------------

describe('mixed markdown and JSX content', () => {
  it('produces blocks in document order', async () => {
    const mdx = [
      'Here are our ambassadors:',
      '',
      '<Ambassador slug="alice" />',
      '',
      'More text below.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith({ alice: 'doc-alice' }))

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Here are our ambassadors:'
    })
    expect(blocks[1]).toEqual({
      __component: 'blocks.ambassador',
      ambassador: { connect: [{ documentId: 'doc-alice' }] }
    })
    expect(blocks[2]).toEqual({
      __component: 'blocks.paragraph',
      content: 'More text below.'
    })
  })
})
