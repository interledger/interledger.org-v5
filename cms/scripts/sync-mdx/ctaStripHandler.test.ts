import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers CtaStrip handler
import './ctaStripHandler'

const ctx: ParserContext = { locale: 'en' }

const open = (attrs: string) => `<CtaStrip ${attrs}>`

// ---------------------------------------------------------------------------
// CtaStrip handler
// ---------------------------------------------------------------------------

describe('CtaStrip handler', () => {
  it('parses a full strip with secondary CTA and colour', async () => {
    const mdx = [
      open(
        'heading="Apply now" primaryButtonText="Stay in touch" primaryButtonLink="/contact" secondaryButtonText="Get involved" secondaryButtonLink="/get-involved" color="green"'
      ),
      'This is a reminder text.',
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.cta-strip',
        heading: 'Apply now',
        description: 'This is a reminder text.',
        primaryButtonText: 'Stay in touch',
        primaryButtonLink: '/contact',
        secondaryButtonText: 'Get involved',
        secondaryButtonLink: '/get-involved',
        color: 'green'
      }
    ])
  })

  it('parses a minimal strip (primary CTA only) and defaults colour to purple', async () => {
    const mdx = [
      open(
        'heading="Stay up to date" primaryButtonText="Subscribe" primaryButtonLink="/newsletter"'
      ),
      'Sign up for our newsletter.',
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.cta-strip',
        heading: 'Stay up to date',
        description: 'Sign up for our newsletter.',
        primaryButtonText: 'Subscribe',
        primaryButtonLink: '/newsletter',
        color: 'purple'
      }
    ])
  })

  it('omits secondary fields when not provided', async () => {
    const mdx = [
      open('heading="H" primaryButtonText="P" primaryButtonLink="/p"'),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    expect(blocks[0]).not.toHaveProperty('secondaryButtonText')
    expect(blocks[0]).not.toHaveProperty('secondaryButtonLink')
  })

  it('preserves markdown in the description', async () => {
    const mdx = [
      open('heading="H" primaryButtonText="P" primaryButtonLink="/p"'),
      'Visit [our site](https://interledger.org) for **more**.',
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const description = (blocks[0] as { description: string }).description
    expect(description).toContain('[our site](https://interledger.org)')
    expect(description).toContain('**more**')
  })

  it('returns MISSING_REQUIRED_PROP when heading is absent', async () => {
    const mdx = [
      open('primaryButtonText="P" primaryButtonLink="/p"'),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when a primary CTA field is absent', async () => {
    const mdx = [
      open('heading="H" primaryButtonText="P"'),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns INVALID_PROP_VALUE when description (children) is empty', async () => {
    const result = await parseMdxToBlocks(
      '<CtaStrip heading="H" primaryButtonText="P" primaryButtonLink="/p" />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE for an unsupported colour', async () => {
    const mdx = [
      open(
        'heading="H" primaryButtonText="P" primaryButtonLink="/p" color="blue"'
      ),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns CONFLICTING_PROPS when only one secondary field is present', async () => {
    const mdx = [
      open(
        'heading="H" primaryButtonText="P" primaryButtonLink="/p" secondaryButtonText="S"'
      ),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.CONFLICTING_PROPS })
  })
})

// ---------------------------------------------------------------------------
// Locale context
// ---------------------------------------------------------------------------

describe('CtaStrip handler (locale context)', () => {
  it('produces identical output for en and es locales', async () => {
    const mdx = [
      open(
        'heading="Aplica ya" primaryButtonText="Suscríbete" primaryButtonLink="/es/boletin" color="green"'
      ),
      'Mantente al día con nuestras novedades.',
      '</CtaStrip>'
    ].join('\n')

    const enBlocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    const esBlocks = await parseMdxToBlocks(mdx, { locale: 'es' })

    expect(esBlocks).toEqual(enBlocks)
  })
})
