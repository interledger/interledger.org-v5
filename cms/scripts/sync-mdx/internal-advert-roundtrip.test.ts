import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/internal-advert.serializer'

// Side-effect import: registers the InternalAdvert handler
import './internalAdvertHandler'

/**
 * Round-trip is serialize (Strapi block → MDX) then parse (MDX → block). The
 * parser resolves the logo path back to the id the resolver map assigns, so
 * the assertions use ids rather than urls.
 */
function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) throw new Error(`Upload "${url}" not found.`)
      return id
    }
  }
}

describe('InternalAdvert round-trip (serialize → parse)', () => {
  it('round-trips a full card', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        logo: {
          image: { url: '/uploads/wm-logo.svg' },
          alternativeText: ''
        },
        logoLabel: 'Web Monetization',
        headline: 'Revolutionizing the digital content economy.',
        body: 'Web Monetization connects publishers and creators.',
        socialLinks: [
          { url: 'https://www.linkedin.com/company/web-monetization/' },
          { url: 'https://www.instagram.com/webmonetization/' }
        ],
        buttonText: 'Visit Web Monetization',
        buttonLink: 'https://webmonetization.org',
        buttonExternal: true
      }),
      ctxWith({ '/uploads/wm-logo.svg': 7 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.internal-advert',
        helperText: 'Know more',
        logo: { image: 7, alternativeText: '' },
        logoLabel: 'Web Monetization',
        headline: 'Revolutionizing the digital content economy.',
        body: 'Web Monetization connects publishers and creators.',
        socialLinks: [
          { url: 'https://www.linkedin.com/company/web-monetization/' },
          { url: 'https://www.instagram.com/webmonetization/' }
        ],
        buttonText: 'Visit Web Monetization',
        buttonLink: 'https://webmonetization.org',
        buttonExternal: true
      }
    ])
  })

  it('round-trips a card with no logo and no button', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        headline: 'A headline',
        body: 'A body.'
      }),
      ctxWith()
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.internal-advert',
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        headline: 'A headline',
        body: 'A body.'
      }
    ])
  })

  it('round-trips a body-only card, with no headline', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        body: 'A body with no headline above it.'
      }),
      ctxWith()
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.internal-advert',
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        body: 'A body with no headline above it.'
      }
    ])
  })

  it('round-trips a document button', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        headline: 'A headline',
        buttonText: 'Download the report',
        buttonLink: '/uploads/report.pdf',
        buttonDocument: true
      }),
      ctxWith()
    )

    expect(blocks[0]).toMatchObject({
      buttonText: 'Download the report',
      buttonLink: '/uploads/report.pdf',
      buttonDocument: true
    })
  })

  it('keeps a false flag out of the round trip rather than storing it', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        headline: 'A headline',
        buttonText: 'Visit',
        buttonLink: '/x',
        buttonExternal: false,
        buttonDocument: false
      }),
      ctxWith()
    )

    expect(blocks[0]).not.toHaveProperty('buttonExternal')
    expect(blocks[0]).not.toHaveProperty('buttonDocument')
  })

  it('round-trips markdown inside the body', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        helperText: 'Know more',
        headline: 'A headline',
        body: 'Read the [documentation](https://webmonetization.org/docs).'
      }),
      ctxWith()
    )

    expect(blocks[0]).toMatchObject({
      body: 'Read the [documentation](https://webmonetization.org/docs).'
    })
  })
})
