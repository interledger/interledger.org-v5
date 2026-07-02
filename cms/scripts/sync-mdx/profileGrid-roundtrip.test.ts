import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/profile-grid.serializer'

// Side-effect import: registers ProfileGrid handler
import './profileHandler'

const ctx: ParserContext = { locale: 'en' }

function ctxWithResolver(knownSlugs: Record<string, string>): ParserContext {
  return {
    locale: 'en',
    resolveRelation: async (_apiId: string, pathSlug: string) => {
      const documentId = knownSlugs[pathSlug]
      if (!documentId) throw new Error(`Slug "${pathSlug}" not found.`)
      return { documentId }
    }
  }
}

describe('ProfileGrid round-trip (serialize → parse)', () => {
  it('round-trips a category-only grid', async () => {
    const original = { category: '2025 Hackathon Judges' }
    const blocks = await parseMdxToBlocks(serialize(original), ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile-grid',
        category: '2025 Hackathon Judges'
      }
    ])
  })

  it('round-trips a grid with a heading', async () => {
    const original = { heading: 'Meet the judges', category: 'Leadership' }
    const blocks = await parseMdxToBlocks(serialize(original), ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile-grid',
        category: 'Leadership',
        heading: 'Meet the judges'
      }
    ])
  })

  it('round-trips manually picked profiles, preserving order', async () => {
    const original = {
      heading: 'Meet the judges',
      profiles: [
        { name: 'Alice', pathSlug: 'alice' },
        { name: 'Bob', pathSlug: 'bob' }
      ]
    }
    const resolverCtx = ctxWithResolver({
      alice: 'doc-alice',
      bob: 'doc-bob'
    })
    const blocks = await parseMdxToBlocks(serialize(original), resolverCtx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.profile-grid',
        heading: 'Meet the judges',
        profiles: {
          connect: [{ documentId: 'doc-alice' }, { documentId: 'doc-bob' }]
        }
      }
    ])
  })

  it('errors when neither pathSlugs nor category is present', async () => {
    const result = await parseMdxToBlocks('<ProfileGrid heading="x" />', ctx)
    expect(result).toBeInstanceOf(Error)
  })
})
