import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/cta-strip.serializer'

// Side-effect import: registers CtaStrip handler
import './ctaStripHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('CtaStrip round-trip (serialize → parse)', () => {
  it('round-trips a full strip (en)', async () => {
    const original = {
      heading: 'Apply now',
      description: 'This is a reminder text.',
      primaryButtonText: 'Stay in touch',
      primaryButtonLink: '/contact',
      secondaryButtonText: 'Get involved',
      secondaryButtonLink: '/get-involved',
      color: 'green' as const
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
  })

  it('round-trips a full strip (es)', async () => {
    const original = {
      heading: 'Aplica ya',
      description: 'Mantente al día con nuestras novedades.',
      primaryButtonText: 'Suscríbete',
      primaryButtonLink: '/es/boletin',
      secondaryButtonText: 'Participa',
      secondaryButtonLink: '/es/participa',
      color: 'purple' as const
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
  })

  it('round-trips a minimal strip and defaults colour to purple', async () => {
    const original = {
      heading: 'Stay up to date',
      description: 'Sign up for our newsletter.',
      primaryButtonText: 'Subscribe',
      primaryButtonLink: '/newsletter'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.cta-strip', ...original, color: 'purple' }
    ])
    expect(blocks[0]).not.toHaveProperty('secondaryButtonText')
  })

  it('preserves brace-escaped content through a round-trip', async () => {
    const original = {
      heading: 'H',
      description: 'Use {tokens} wisely.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)
    const description = (blocks[0] as { description: string }).description
    expect(description).toContain('{tokens}')
  })
})
