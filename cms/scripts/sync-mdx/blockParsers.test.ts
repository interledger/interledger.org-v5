/**
 * Tests for block parsers — each test starts from real MDX text,
 * parses it with remark + remark-mdx, and validates the Strapi block output.
 *
 * Organised by block type so it's easy to find & maintain the tests for
 * each component.  Each section tests the happy path plus error cases.
 */

import { describe, it, expect } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import {
  parseAmbassador,
  parseAmbassadorsGrid,
  parseBlockquote,
  parseCalloutText,
  parseCtaBanner,
  parseImageRow,
  parseCardsGrid,
  parseCardLinksGrid,
  parseCarousel
} from './blockParsers'

/** Parse MDX and return the first JSX flow element. */
function firstJsx(mdx: string): MdxJsxFlowElement {
  const tree = remark().use(remarkMdx).parse(mdx)
  const node = tree.children.find((n) => n.type === 'mdxJsxFlowElement')
  if (!node) throw new Error('No JSX flow element found in:\n' + mdx)
  return node as MdxJsxFlowElement
}

// ==========================================================================
// Simple block parsers
// ==========================================================================

describe('parseAmbassador', () => {
  it('extracts slug from a self-closing element', () => {
    const node = firstJsx(
      '<Ambassador name="Alice" slug="alice" description="Dev" photo="" photoAlt="" linkedinUrl="" grantReportUrl="" />'
    )
    const block = parseAmbassador(node)
    expect(block).toMatchObject({
      __component: 'blocks.ambassador',
      ambassador: 'alice'
    })
  })

  it('extracts showLinks when present', () => {
    const node = firstJsx('<Ambassador slug="alice" showLinks={false} />')
    const block = parseAmbassador(node)
    expect(block.showLinks).toBe(false)
  })

  it('omits showLinks when absent', () => {
    const node = firstJsx('<Ambassador slug="alice" />')
    const block = parseAmbassador(node)
    expect(block).not.toHaveProperty('showLinks')
  })

  it('throws when slug is missing', () => {
    const node = firstJsx('<Ambassador name="Alice" />')
    expect(() => parseAmbassador(node)).toThrow(/Missing required prop 'slug'/)
  })
})

describe('parseAmbassadorsGrid', () => {
  it('extracts heading and slugs', () => {
    const node = firstJsx(
      '<AmbassadorGrid heading="Our team" slugs={["alice","bob"]} />'
    )
    const block = parseAmbassadorsGrid(node)
    expect(block).toEqual({
      __component: 'blocks.ambassadors-grid',
      heading: 'Our team',
      ambassadors: ['alice', 'bob']
    })
  })

  it('handles missing optional heading', () => {
    const node = firstJsx('<AmbassadorGrid slugs={["x"]} />')
    const block = parseAmbassadorsGrid(node)
    expect(block).not.toHaveProperty('heading')
    expect(block.ambassadors).toEqual(['x'])
  })

  it('handles empty slugs array', () => {
    const node = firstJsx('<AmbassadorGrid heading="Team" slugs={[]} />')
    expect(parseAmbassadorsGrid(node).ambassadors).toEqual([])
  })

  it('defaults to empty array when slugs is absent', () => {
    const node = firstJsx('<AmbassadorGrid heading="Team" />')
    expect(parseAmbassadorsGrid(node).ambassadors).toEqual([])
  })
})

describe('parseBlockquote', () => {
  it('extracts source and children text', () => {
    const mdx = `<Blockquote source="**Jane**, Acme">\nGreat work.\n</Blockquote>`
    const block = parseBlockquote(firstJsx(mdx))
    expect(block).toEqual({
      __component: 'blocks.blockquote',
      quote: 'Great work.',
      source: '**Jane**, Acme'
    })
  })

  it('handles blockquote without source', () => {
    const mdx = '<Blockquote>\nJust a quote.\n</Blockquote>'
    const block = parseBlockquote(firstJsx(mdx))
    expect(block.quote).toBe('Just a quote.')
    expect(block).not.toHaveProperty('source')
  })

  it('handles multiline children', () => {
    const mdx =
      '<Blockquote source="Author">\nLine one.\n\nLine two.\n</Blockquote>'
    const block = parseBlockquote(firstJsx(mdx))
    expect(block.quote).toContain('Line one.')
    expect(block.quote).toContain('Line two.')
  })

  it('unescapes curly braces in quote text', () => {
    const mdx = '<Blockquote>\nSome \\{escaped\\} braces.\n</Blockquote>'
    const block = parseBlockquote(firstJsx(mdx))
    expect(block.quote).toContain('{escaped}')
  })
})

describe('parseCalloutText', () => {
  it('extracts content from children', () => {
    const mdx = '<CalloutText>\nImportant message here.\n</CalloutText>'
    const block = parseCalloutText(firstJsx(mdx))
    expect(block).toEqual({
      __component: 'blocks.callout-text',
      content: 'Important message here.'
    })
  })

  it('handles markdown content', () => {
    const mdx = '<CalloutText>\nThis is *important* content\n</CalloutText>'
    const block = parseCalloutText(firstJsx(mdx))
    expect(block.content).toContain('*important*')
  })
})

describe('parseCtaBanner', () => {
  it('extracts all attributes and description', () => {
    const mdx = `<CtaBanner title="Join Us" ctaText="Sign Up" ctaUrl="/join" backgroundColor="primary">
Become a member today.
</CtaBanner>`
    const block = parseCtaBanner(firstJsx(mdx))
    expect(block).toMatchObject({
      __component: 'blocks.cta-banner',
      title: 'Join Us',
      ctaText: 'Sign Up',
      ctaUrl: '/join',
      backgroundColor: 'primary'
    })
    expect(block.description).toContain('Become a member today.')
  })

  it('handles CTA without optional props', () => {
    const mdx = '<CtaBanner title="Hello">\nSome text.\n</CtaBanner>'
    const block = parseCtaBanner(firstJsx(mdx))
    expect(block.title).toBe('Hello')
    expect(block).not.toHaveProperty('ctaText')
    expect(block).not.toHaveProperty('ctaUrl')
    expect(block).not.toHaveProperty('backgroundColor')
  })

  it('throws when title is missing', () => {
    const mdx = '<CtaBanner ctaText="Go">\nText\n</CtaBanner>'
    expect(() => parseCtaBanner(firstJsx(mdx))).toThrow(
      /Missing required prop 'title'/
    )
  })
})

describe('parseImageRow', () => {
  it('extracts images from markdown image syntax', () => {
    const mdx = `<ImageRow>
  ![Team photo](/img/team.jpg)
</ImageRow>`
    const block = parseImageRow(firstJsx(mdx))
    expect(block.__component).toBe('blocks.image-row')
    expect(block.images).toEqual([
      { url: '/img/team.jpg', alternativeText: 'Team photo' }
    ])
  })

  it('extracts multiple images', () => {
    const mdx = `<ImageRow>

![First](/img/1.jpg)
![Second](/img/2.jpg)

</ImageRow>`
    const block = parseImageRow(firstJsx(mdx))
    expect((block.images as Array<Record<string, unknown>>).length).toBe(2)
  })

  it('handles empty ImageRow', () => {
    const mdx = '<ImageRow>\n</ImageRow>'
    const block = parseImageRow(firstJsx(mdx))
    expect(block.images).toEqual([])
  })
})

// ==========================================================================
// Container block parsers
// ==========================================================================

describe('parseCardsGrid', () => {
  it('extracts grid with multiple cards', () => {
    const mdx = `<CardsGrid columns={3}>

<Card title="Card 1" link="/one" linkText="Go">
Description one
</Card>

<Card title="Card 2" link="/two">
Description two
</Card>

</CardsGrid>`
    const block = parseCardsGrid(firstJsx(mdx))
    expect(block).toMatchObject({
      __component: 'blocks.cards-grid',
      columns: '3',
      cards: [
        {
          title: 'Card 1',
          link: '/one',
          linkText: 'Go',
          description: 'Description one'
        },
        { title: 'Card 2', link: '/two', description: 'Description two' }
      ]
    })
  })

  it('defaults to 3 columns when not specified', () => {
    const mdx = `<CardsGrid>

<Card title="Solo">
Desc
</Card>

</CardsGrid>`
    const block = parseCardsGrid(firstJsx(mdx))
    expect(block.columns).toBe('3')
  })

  it('handles empty grid', () => {
    const mdx = '<CardsGrid columns={2}>\n</CardsGrid>'
    const block = parseCardsGrid(firstJsx(mdx))
    expect(block.cards).toEqual([])
  })

  it('extracts optional card attributes', () => {
    const mdx = `<CardsGrid columns={2}>

<Card title="IC" icon="globe" openInNewTab={true}>
Desc
</Card>

</CardsGrid>`
    const block = parseCardsGrid(firstJsx(mdx))
    const card = (block.cards as Array<Record<string, unknown>>)[0]
    expect(card.icon).toBe('globe')
    expect(card.openInNewTab).toBe(true)
  })
})

describe('parseCardLinksGrid', () => {
  it('extracts links from CardLink children', () => {
    const mdx = `<CardLinksGrid>

<CardLink title="Link 1" url="/page1" icon="arrow">
First link description
</CardLink>

<CardLink title="Link 2" url="/page2">
Second link description
</CardLink>

</CardLinksGrid>`
    const block = parseCardLinksGrid(firstJsx(mdx))
    expect(block).toMatchObject({
      __component: 'blocks.card-links-grid',
      links: [
        {
          title: 'Link 1',
          href: '/page1',
          icon: 'arrow',
          description: 'First link description'
        },
        {
          title: 'Link 2',
          href: '/page2',
          description: 'Second link description'
        }
      ]
    })
  })

  it('handles empty CardLinksGrid', () => {
    const mdx = '<CardLinksGrid>\n</CardLinksGrid>'
    const block = parseCardLinksGrid(firstJsx(mdx))
    expect(block.links).toEqual([])
  })
})

describe('parseCarousel', () => {
  it('extracts items from CarouselItem children', () => {
    const mdx = `<Carousel>

<CarouselItem title="Slide 1" image="/img/s1.jpg" link="/s1">
First slide text
</CarouselItem>

<CarouselItem title="Slide 2">
Second slide text
</CarouselItem>

</Carousel>`
    const block = parseCarousel(firstJsx(mdx))
    expect(block).toMatchObject({
      __component: 'blocks.carousel',
      items: [
        {
          title: 'Slide 1',
          image: '/img/s1.jpg',
          link: '/s1',
          description: 'First slide text'
        },
        { title: 'Slide 2', description: 'Second slide text' }
      ]
    })
  })

  it('handles empty carousel', () => {
    const mdx = '<Carousel>\n</Carousel>'
    const block = parseCarousel(firstJsx(mdx))
    expect(block.items).toEqual([])
  })
})
