/**
 * Round-trip validation tests.
 *
 * These tests prove that content survives a full Strapi → MDX → Strapi
 * round-trip.  They use the existing serializers (the "forward" direction)
 * together with the new block parser (the "reverse" direction) and verify
 * that the data comes back structurally equivalent.
 *
 * This is the acceptance-level test: if serialize → parse gives back the
 * same data, the implementation is correct by construction.
 */

import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'

// Import serializers — the working Strapi → MDX direction
import { serialize as serializeAmbassador } from '../../src/serializers/blocks/ambassador.serializer'
import { serialize as serializeAmbassadorsGrid } from '../../src/serializers/blocks/ambassadors-grid.serializer'
import { serialize as serializeBlockquote } from '../../src/serializers/blocks/blockquote.serializer'
import { serialize as serializeCalloutText } from '../../src/serializers/blocks/callout-text.serializer'
import { serialize as serializeCtaBanner } from '../../src/serializers/blocks/cta-banner.serializer'
import { serialize as serializeCardsGrid } from '../../src/serializers/blocks/cards-grid.serializer'
import { serialize as serializeCardLinksGrid } from '../../src/serializers/blocks/card-links-grid.serializer'
import { serialize as serializeCarousel } from '../../src/serializers/blocks/carousel.serializer'
import { serialize as serializeParagraph } from '../../src/serializers/blocks/paragraph.serializer'
import { serializeContent } from '../../src/serializers/blocks/index'

// ==========================================================================
// Individual block type round-trips
// ==========================================================================

describe('round-trip: serialize then parse', () => {
  it('ambassador survives round-trip', () => {
    const original = {
      ambassador: {
        name: 'Alice Smith',
        slug: 'alice-smith',
        description: 'Developer advocate',
        photo: null,
        photoAlt: '',
        linkedinUrl: 'https://linkedin.com/in/alice',
        grantReportUrl: ''
      }
    }
    const mdx = serializeAmbassador(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].__component).toBe('blocks.ambassador')
    expect(blocks[0].ambassador).toBe('alice-smith')
  })

  it('ambassadors-grid survives round-trip', () => {
    const original = {
      heading: 'Our team',
      ambassadors: [{ slug: 'alice' }, { slug: 'bob' }]
    }
    const mdx = serializeAmbassadorsGrid(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.ambassadors-grid',
      heading: 'Our team',
      ambassadors: ['alice', 'bob']
    })
  })

  it('blockquote survives round-trip', () => {
    const original = {
      quote: 'Interledger changed how we think about open payments.',
      source: '**Jane Doe**, Acme Corp'
    }
    const mdx = serializeBlockquote(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.blockquote',
      source: '**Jane Doe**, Acme Corp'
    })
    expect(blocks[0].quote).toContain(
      'Interledger changed how we think about open payments.'
    )
  })

  it('callout-text survives round-trip', () => {
    const original = { content: 'This is an important announcement.' }
    const mdx = serializeCalloutText(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.callout-text',
      content: 'This is an important announcement.'
    })
  })

  it('cta-banner survives round-trip', () => {
    const original = {
      title: 'Join the movement',
      description: 'Become a contributor today.',
      ctaText: 'Get started',
      ctaUrl: '/join',
      backgroundColor: 'primary'
    }
    const mdx = serializeCtaBanner(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.cta-banner',
      title: 'Join the movement',
      ctaText: 'Get started',
      ctaUrl: '/join',
      backgroundColor: 'primary'
    })
    expect(blocks[0].description).toContain('Become a contributor today.')
  })

  it('paragraph (plain markdown) survives round-trip', () => {
    const original = { content: 'Hello world.\n\nSecond paragraph.' }
    const mdx = serializeParagraph(original)
    const blocks = parseMdxToBlocks(mdx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.paragraph',
      content: 'Hello world.\n\nSecond paragraph.'
    })
  })

  it('cards-grid with heading and cards survives round-trip', () => {
    const original = {
      heading: 'Our Services',
      subheading: 'What we offer',
      columns: '2',
      cards: [
        {
          title: 'Card One',
          description: 'Description one',
          link: '/one',
          linkText: 'Learn more'
        },
        {
          title: 'Card Two',
          description: 'Description two',
          icon: 'globe'
        }
      ]
    }
    const mdx = serializeCardsGrid(original)
    const blocks = parseMdxToBlocks(mdx)

    // The serializer emits: ## heading\n\nsubheading\n\n<CardsGrid ...>
    // The parser should absorb the heading/subheading into the CardsGrid block
    const grid = blocks.find((b) => b.__component === 'blocks.cards-grid')
    expect(grid).toBeDefined()
    expect(grid!.heading).toBe('Our Services')
    expect(grid!.subheading).toBe('What we offer')
    expect(grid!.columns).toBe('2')

    const cards = grid!.cards as Array<Record<string, unknown>>
    expect(cards).toHaveLength(2)
    expect(cards[0].title).toBe('Card One')
    expect(cards[0].link).toBe('/one')
    expect(cards[0].linkText).toBe('Learn more')
    expect(cards[1].title).toBe('Card Two')
    expect(cards[1].icon).toBe('globe')
  })

  it('card-links-grid with heading survives round-trip', () => {
    const original = {
      heading: 'Quick Links',
      links: [
        {
          title: 'Documentation',
          description: 'Read the docs',
          url: '/docs',
          icon: 'book'
        },
        { title: 'GitHub', url: 'https://github.com/interledger' }
      ]
    }
    const mdx = serializeCardLinksGrid(original)
    const blocks = parseMdxToBlocks(mdx)

    const grid = blocks.find((b) => b.__component === 'blocks.card-links-grid')
    expect(grid).toBeDefined()
    expect(grid!.heading).toBe('Quick Links')

    const links = grid!.links as Array<Record<string, unknown>>
    expect(links).toHaveLength(2)
    expect(links[0].title).toBe('Documentation')
    expect(links[0].href).toBe('/docs')
    expect(links[0].icon).toBe('book')
    expect(links[1].title).toBe('GitHub')
    expect(links[1].href).toBe('https://github.com/interledger')
  })

  it('carousel with items survives round-trip', () => {
    const original = {
      heading: 'Testimonials',
      items: [
        {
          title: 'Slide 1',
          description: 'Great platform.',
          image: { url: '/img/slide1.jpg' },
          link: '/testimonial/1'
        },
        { title: 'Slide 2', description: 'Amazing experience.' }
      ]
    }
    const mdx = serializeCarousel(original)
    const blocks = parseMdxToBlocks(mdx)

    const carousel = blocks.find((b) => b.__component === 'blocks.carousel')
    expect(carousel).toBeDefined()
    expect(carousel!.heading).toBe('Testimonials')

    const items = carousel!.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Slide 1')
    expect(items[0].image).toBe('/img/slide1.jpg')
    expect(items[0].link).toBe('/testimonial/1')
    expect(items[1].title).toBe('Slide 2')
  })
})

// ==========================================================================
// Full page round-trip (mixed blocks)
// ==========================================================================

describe('round-trip: full page with mixed blocks', () => {
  it('multi-block page survives serialize → parse', () => {
    const strapiContent = [
      {
        __component: 'blocks.paragraph',
        content: 'The Interledger Foundation.'
      },
      {
        __component: 'blocks.ambassadors-grid',
        heading: 'Meet the team',
        ambassadors: [{ slug: 'alice' }, { slug: 'bob' }]
      },
      {
        __component: 'blocks.blockquote',
        quote: 'Open payments for all.',
        source: '**CEO**, Foundation'
      },
      {
        __component: 'blocks.cta-banner',
        title: 'Get Involved',
        description: 'Join our community.',
        ctaText: 'Sign up',
        ctaUrl: '/signup'
      }
    ]

    const mdx = serializeContent(strapiContent)
    const parsed = parseMdxToBlocks(mdx)

    expect(parsed).toHaveLength(4)

    // Block 1: paragraph
    expect(parsed[0].__component).toBe('blocks.paragraph')
    expect(parsed[0].content).toBe('The Interledger Foundation.')

    // Block 2: ambassadors-grid
    expect(parsed[1].__component).toBe('blocks.ambassadors-grid')
    expect(parsed[1].heading).toBe('Meet the team')
    expect(parsed[1].ambassadors).toEqual(['alice', 'bob'])

    // Block 3: blockquote
    expect(parsed[2].__component).toBe('blocks.blockquote')
    expect(parsed[2].source).toBe('**CEO**, Foundation')

    // Block 4: cta-banner
    expect(parsed[3].__component).toBe('blocks.cta-banner')
    expect(parsed[3].title).toBe('Get Involved')
    expect(parsed[3].ctaText).toBe('Sign up')
    expect(parsed[3].ctaUrl).toBe('/signup')
  })

  it('page with only paragraphs survives round-trip', () => {
    const strapiContent = [
      { __component: 'blocks.paragraph', content: 'First paragraph.' },
      {
        __component: 'blocks.paragraph',
        content: 'Second paragraph with **bold**.'
      }
    ]

    const mdx = serializeContent(strapiContent)
    const parsed = parseMdxToBlocks(mdx)

    // Multiple paragraph blocks may get merged into one by the serializer
    // (since serializeContent just joins with \n\n). This is expected.
    expect(parsed.length).toBeGreaterThanOrEqual(1)
    expect(parsed[0].__component).toBe('blocks.paragraph')
    expect(parsed[0].content).toContain('First paragraph.')
    expect(parsed[0].content).toContain('Second paragraph with **bold**.')
  })

  it('ambassador followed by paragraph survives round-trip', () => {
    const strapiContent = [
      {
        __component: 'blocks.ambassador',
        ambassador: {
          name: 'Test',
          slug: 'test-person',
          description: 'Tester',
          photo: null,
          photoAlt: '',
          linkedinUrl: '',
          grantReportUrl: ''
        }
      },
      { __component: 'blocks.paragraph', content: 'More info below.' }
    ]

    const mdx = serializeContent(strapiContent)
    const parsed = parseMdxToBlocks(mdx)

    expect(parsed[0].__component).toBe('blocks.ambassador')
    expect(parsed[0].ambassador).toBe('test-person')
    const lastBlock = parsed[parsed.length - 1]
    expect(lastBlock.__component).toBe('blocks.paragraph')
    expect(lastBlock.content).toContain('More info below.')
  })
})
