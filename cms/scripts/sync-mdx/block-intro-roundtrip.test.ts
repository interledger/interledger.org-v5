import { describe, expect, it } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize as serializeBlockquote } from '../../src/serializers/blocks/blockquote.serializer'
import { serialize as serializeCarousel } from '../../src/serializers/blocks/carousel.serializer'
import { serialize as serializeCtaButtons } from '../../src/serializers/blocks/cta-buttons.serializer'
import { serialize as serializeImageBlock } from '../../src/serializers/blocks/image-block.serializer'
import { serialize as serializePdfEmbed } from '../../src/serializers/blocks/pdf-embed.serializer'
import { serialize as serializeQuote } from '../../src/serializers/blocks/quote.serializer'
import { serialize as serializeVideoEmbed } from '../../src/serializers/blocks/video-embed.serializer'

// Side-effect imports: register the handlers
import './blockquoteHandler'
import './carouselHandler'
import './ctaButtonsHandler'
import './imageBlockHandler'
import './pdfEmbedHandler'
import './quoteHandler'
import './videoEmbedHandler'

const ctx: ParserContext = {
  locale: 'en',
  resolveMediaUpload: async () => 7
}

const intro = {
  heading: 'Heading',
  subheading: 'Subheading',
  description: 'A [link](/more/) and **bold** text.'
}

// Blocks that gained an intro with no legacy heading: serialize → parse
// keeps the intro, and leaves it out when there is none.
const cases: Array<[string, (withIntro: boolean) => string]> = [
  [
    'ImageBlock',
    (withIntro) =>
      serializeImageBlock({
        ...(withIntro ? { intro } : {}),
        media: { image: { url: '/img/a.png' }, alternativeText: 'A' }
      })
  ],
  [
    'VideoEmbed',
    (withIntro) =>
      serializeVideoEmbed({
        ...(withIntro ? { intro } : {}),
        externalUrl: 'https://youtu.be/x',
        title: 'Play'
      })
  ],
  [
    'PdfEmbed',
    (withIntro) =>
      serializePdfEmbed({
        ...(withIntro ? { intro } : {}),
        externalUrl: 'https://example.com/a.pdf'
      })
  ],
  [
    'Quote',
    (withIntro) =>
      serializeQuote({ ...(withIntro ? { intro } : {}), quote: 'Words.' })
  ],
  [
    'Blockquote',
    (withIntro) =>
      serializeBlockquote({ ...(withIntro ? { intro } : {}), quote: 'Words.' })
  ],
  [
    'CtaButtons',
    (withIntro) =>
      serializeCtaButtons({
        ...(withIntro ? { intro } : {}),
        buttons: [{ text: 'Apply', link: '/apply/', style: 'primary' }]
      })
  ]
]

describe('block intro round-trip on intro-only blocks', () => {
  it.each(cases)('%s keeps its intro', async (_tag, mdx) => {
    const blocks = await parseMdxToBlocks(mdx(true), ctx)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ intro })
  })

  it.each(cases)('%s has no intro without one', async (_tag, mdx) => {
    const blocks = await parseMdxToBlocks(mdx(false), ctx)
    expect(blocks[0]).not.toHaveProperty('intro')
  })

  describe('LogoCarousel', () => {
    const logos = [
      { image: { url: '/img/plata.png' }, alternativeText: 'Plata' }
    ]

    it('keeps its intro', async () => {
      const blocks = await parseMdxToBlocks(
        serializeCarousel({ intro, accessibilityLabel: 'Partners', logos }),
        ctx
      )
      expect(blocks[0]).toMatchObject({ intro, accessibilityLabel: 'Partners' })
      expect(blocks[0]).not.toHaveProperty('heading')
    })

    it('exports a legacy heading as the intro heading', async () => {
      const blocks = await parseMdxToBlocks(
        serializeCarousel({
          heading: 'In partnership with',
          accessibilityLabel: 'Partners',
          logos
        }),
        ctx
      )
      expect(blocks[0]).toMatchObject({
        intro: { heading: 'In partnership with' }
      })
      expect(blocks[0]).not.toHaveProperty('heading')
    })
  })
})
