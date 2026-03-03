/**
 * Tests for the top-level MDX → Strapi block parser (AST walker)
 * and relation resolution.
 *
 * These are integration-level tests that validate the full path from
 * an MDX body string to the final Strapi block array.
 */

import { describe, it, expect, vi } from 'vitest'
import { parseMdxToBlocks, resolveBlockRelations } from './mdxBlockParser'
import type { StrapiClient } from './strapiClient'

// ==========================================================================
// parseMdxToBlocks — full MDX body → ordered Strapi blocks
// ==========================================================================

describe('parseMdxToBlocks', () => {
  it('converts a mixed MDX body into ordered Strapi blocks', () => {
    const mdx = `
Some intro paragraph.

<AmbassadorGrid heading="Our team" slugs={["alice","bob"]} />

More text here.

<Blockquote source="**Jane**">
A great quote.
</Blockquote>
`
    const blocks = parseMdxToBlocks(mdx)
    expect(blocks).toEqual([
      { __component: 'blocks.paragraph', content: 'Some intro paragraph.' },
      {
        __component: 'blocks.ambassadors-grid',
        heading: 'Our team',
        ambassadors: ['alice', 'bob']
      },
      { __component: 'blocks.paragraph', content: 'More text here.' },
      {
        __component: 'blocks.blockquote',
        quote: 'A great quote.',
        source: '**Jane**'
      }
    ])
  })

  it('handles MDX with only text (no JSX)', () => {
    const blocks = parseMdxToBlocks(
      'Just some plain text.\n\nAnother paragraph.'
    )
    expect(blocks).toEqual([
      {
        __component: 'blocks.paragraph',
        content: 'Just some plain text.\n\nAnother paragraph.'
      }
    ])
  })

  it('handles MDX with only JSX (no text)', () => {
    const mdx = `<Ambassador slug="alice" />

<Ambassador slug="bob" />`
    const blocks = parseMdxToBlocks(mdx)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].__component).toBe('blocks.ambassador')
    expect(blocks[1].__component).toBe('blocks.ambassador')
  })

  it('handles adjacent JSX components with no text between them', () => {
    const mdx = `<AmbassadorGrid heading="Team" slugs={["a"]} />

<Blockquote source="Someone">
A quote.
</Blockquote>`
    const blocks = parseMdxToBlocks(mdx)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].__component).toBe('blocks.ambassadors-grid')
    expect(blocks[1].__component).toBe('blocks.blockquote')
  })

  it('throws on unrecognised component', () => {
    const mdx = '<UnknownWidget foo="bar" />'
    expect(() => parseMdxToBlocks(mdx)).toThrow(
      /Unrecognised JSX component <UnknownWidget>/
    )
  })

  it('handles empty MDX body', () => {
    expect(parseMdxToBlocks('')).toEqual([])
    expect(parseMdxToBlocks('   \n\n   ')).toEqual([])
  })

  it('handles complex document with multiple block types', () => {
    const mdx = `
The Interledger Foundation is a mission-driven nonprofit.

<AmbassadorGrid heading="Meet our ambassadors" slugs={["andria-barret","caroline-sinders"]} />

<Blockquote source="**Jane Doe**, Acme Corp">
Interledger changed how we think about open payments.
</Blockquote>

<CtaBanner title="Join Us" ctaText="Sign Up" ctaUrl="/join">
Become a member today.
</CtaBanner>

Final paragraph at the end.
`
    const blocks = parseMdxToBlocks(mdx)
    expect(blocks).toHaveLength(5)
    expect(blocks[0].__component).toBe('blocks.paragraph')
    expect(blocks[1].__component).toBe('blocks.ambassadors-grid')
    expect(blocks[2].__component).toBe('blocks.blockquote')
    expect(blocks[3].__component).toBe('blocks.cta-banner')
    expect(blocks[4].__component).toBe('blocks.paragraph')
  })

  it('attaches heading to CardsGrid from preceding markdown', () => {
    const mdx = `
## Our Services

<CardsGrid columns={2}>

<Card title="Service A">
Description A
</Card>

</CardsGrid>
`
    const blocks = parseMdxToBlocks(mdx)
    // The ## heading should be absorbed into the CardsGrid block
    const grid = blocks.find((b) => b.__component === 'blocks.cards-grid')
    expect(grid).toBeDefined()
    expect(grid!.heading).toBe('Our Services')
  })

  it('attaches heading and subheading to CardsGrid', () => {
    const mdx = `
## Our Services

A brief intro to our services.

<CardsGrid columns={3}>

<Card title="Card 1">
Desc
</Card>

</CardsGrid>
`
    const blocks = parseMdxToBlocks(mdx)
    const grid = blocks.find((b) => b.__component === 'blocks.cards-grid')
    expect(grid).toBeDefined()
    expect(grid!.heading).toBe('Our Services')
    expect(grid!.subheading).toBe('A brief intro to our services.')
  })

  it('preserves text before a heading that precedes a container', () => {
    const mdx = `
Some standalone intro.

## Grid Section

<CardsGrid columns={2}>

<Card title="C1">
D1
</Card>

</CardsGrid>
`
    const blocks = parseMdxToBlocks(mdx)
    // The intro text should remain as its own paragraph
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Some standalone intro.'
    })
    const grid = blocks.find((b) => b.__component === 'blocks.cards-grid')
    expect(grid!.heading).toBe('Grid Section')
  })
})

// ==========================================================================
// resolveBlockRelations — slug → document ID resolution
// ==========================================================================

describe('resolveBlockRelations', () => {
  function createMockStrapi(): StrapiClient {
    return {
      request: vi.fn(),
      getAllEntries: vi.fn(),
      findBySlug: vi.fn(),
      findUploadByUrl: vi.fn(),
      createLocalization: vi.fn(),
      updateLocalization: vi.fn(),
      createEntry: vi.fn(),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
      deleteLocalization: vi.fn()
    }
  }

  it('resolves ambassador slug to document ID', async () => {
    const strapi = createMockStrapi()
    vi.mocked(strapi.findBySlug).mockResolvedValueOnce({
      documentId: 'doc-alice',
      slug: 'alice'
    })

    const blocks = [{ __component: 'blocks.ambassador', ambassador: 'alice' }]

    const resolved = await resolveBlockRelations(blocks, strapi)
    expect(resolved[0].ambassador).toBe('doc-alice')
    expect(strapi.findBySlug).toHaveBeenCalledWith('ambassadors', 'alice')
  })

  it('resolves ambassadors-grid slugs to document IDs', async () => {
    const strapi = createMockStrapi()
    vi.mocked(strapi.findBySlug)
      .mockResolvedValueOnce({ documentId: 'doc-alice', slug: 'alice' })
      .mockResolvedValueOnce({ documentId: 'doc-bob', slug: 'bob' })

    const blocks = [
      {
        __component: 'blocks.ambassadors-grid',
        heading: 'Team',
        ambassadors: ['alice', 'bob']
      }
    ]

    const resolved = await resolveBlockRelations(blocks, strapi)
    expect(resolved[0].ambassadors).toEqual(['doc-alice', 'doc-bob'])
  })

  it('throws when a slug cannot be resolved', async () => {
    const strapi = createMockStrapi()
    vi.mocked(strapi.findBySlug).mockResolvedValueOnce(undefined)

    const blocks = [
      { __component: 'blocks.ambassador', ambassador: 'nonexistent' }
    ]

    await expect(resolveBlockRelations(blocks, strapi)).rejects.toThrow(
      /Ambassador slug "nonexistent" not found/
    )
  })

  it('passes through blocks with no relations unchanged', async () => {
    const strapi = createMockStrapi()

    const blocks = [
      { __component: 'blocks.paragraph', content: 'Hello world' },
      {
        __component: 'blocks.blockquote',
        quote: 'A quote',
        source: 'Author'
      }
    ]

    const resolved = await resolveBlockRelations(blocks, strapi)
    expect(resolved).toEqual(blocks)
    expect(strapi.findBySlug).not.toHaveBeenCalled()
  })

  it('handles mixed blocks with and without relations', async () => {
    const strapi = createMockStrapi()
    vi.mocked(strapi.findBySlug).mockResolvedValueOnce({
      documentId: 'doc-alice',
      slug: 'alice'
    })

    const blocks = [
      { __component: 'blocks.paragraph', content: 'Intro' },
      {
        __component: 'blocks.ambassadors-grid',
        heading: 'Team',
        ambassadors: ['alice']
      },
      { __component: 'blocks.blockquote', quote: 'Quote', source: 'Source' }
    ]

    const resolved = await resolveBlockRelations(blocks, strapi)
    expect(resolved).toHaveLength(3)
    expect(resolved[0]).toEqual(blocks[0]) // paragraph unchanged
    expect(resolved[1].ambassadors).toEqual(['doc-alice'])
    expect(resolved[2]).toEqual(blocks[2]) // blockquote unchanged
  })
})
