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
  it('parses a strip with both CTAs', async () => {
    const mdx = [
      open(
        'heading="Apply now" primaryButtonText="Stay in touch" primaryButtonLink="/contact" secondaryButtonText="Get involved" secondaryButtonLink="/get-involved"'
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
        secondaryButtonLink: '/get-involved'
      }
    ])
  })

  it('drops a half-specified secondary CTA', async () => {
    const textOnly = await parseMdxToBlocks(
      [
        open(
          'primaryButtonText="Stay in touch" primaryButtonLink="/contact" secondaryButtonText="Get involved"'
        ),
        '</CtaStrip>'
      ].join('\n'),
      ctx
    )
    expect(textOnly[0]).not.toHaveProperty('secondaryButtonText')

    const linkOnly = await parseMdxToBlocks(
      [
        open(
          'primaryButtonText="Stay in touch" primaryButtonLink="/contact" secondaryButtonLink="/get-involved"'
        ),
        '</CtaStrip>'
      ].join('\n'),
      ctx
    )
    expect(linkOnly[0]).not.toHaveProperty('secondaryButtonLink')
  })

  it('parses a minimal strip with a primary CTA only', async () => {
    const mdx = [
      open('primaryButtonText="Subscribe" primaryButtonLink="/newsletter"'),
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.cta-strip',
        primaryButtonText: 'Subscribe',
        primaryButtonLink: '/newsletter'
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

  it('allows heading to be absent', async () => {
    const mdx = [
      open('primaryButtonText="P" primaryButtonLink="/p"'),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toEqual([
      {
        __component: 'blocks.cta-strip',
        description: 'Body.',
        primaryButtonText: 'P',
        primaryButtonLink: '/p'
      }
    ])
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

  it('allows description children to be empty', async () => {
    const result = await parseMdxToBlocks(
      '<CtaStrip heading="H" primaryButtonText="P" primaryButtonLink="/p" />',
      ctx
    )
    expect(result).toEqual([
      {
        __component: 'blocks.cta-strip',
        heading: 'H',
        primaryButtonText: 'P',
        primaryButtonLink: '/p'
      }
    ])
  })

  it('drops an incomplete secondary CTA (only one field present)', async () => {
    const mdx = [
      open(
        'heading="H" primaryButtonText="P" primaryButtonLink="/p" secondaryButtonText="S"'
      ),
      'Body.',
      '</CtaStrip>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.cta-strip' })
    expect(blocks[0]).not.toHaveProperty('secondaryButtonText')
    expect(blocks[0]).not.toHaveProperty('secondaryButtonLink')
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
