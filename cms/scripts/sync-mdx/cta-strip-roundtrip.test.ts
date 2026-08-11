import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/cta-strip.serializer'

// Side-effect import: registers CtaStrip handler
import './ctaStripHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('CtaStrip round-trip (serialize → parse)', () => {
  it('round-trips a full strip (en) and drops legacy secondary/color fields', async () => {
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

    expect(blocks).toEqual([
      {
        __component: 'blocks.cta-strip',
        heading: original.heading,
        description: original.description,
        primaryButtonText: original.primaryButtonText,
        primaryButtonLink: original.primaryButtonLink
      }
    ])
  })

  it('round-trips a full strip (es)', async () => {
    const original = {
      heading: 'Aplica ya',
      description: 'Mantente al día con nuestras novedades.',
      primaryButtonText: 'Suscríbete',
      primaryButtonLink: '/es/boletin'
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
  })

  it('round-trips a minimal strip without adding colour', async () => {
    const original = {
      heading: 'Stay up to date',
      description: 'Sign up for our newsletter.',
      primaryButtonText: 'Subscribe',
      primaryButtonLink: '/newsletter'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
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

  it('round-trips attribute values with quotes, ampersands and angle brackets', async () => {
    const original = {
      heading: 'The "best" offer & <friends>',
      description: 'Body.',
      primaryButtonText: 'Read "more"',
      primaryButtonLink: '/a?x=1&y=2'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
  })

  it('round-trips a description containing a link and a mailto link', async () => {
    const original = {
      heading: 'Before applying',
      description:
        'Check the [Grantmaking FAQs](/grants/faq) to know our approach. For clarifications, reach out to [our team](mailto:programteam@interledger.org).',
      primaryButtonText: 'Apply now',
      primaryButtonLink: '/grants/apply'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.cta-strip', ...original }])
  })

  it('drops a half-filled secondary CTA across the round-trip', async () => {
    const original = {
      heading: 'H',
      description: 'Body.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p',
      secondaryButtonText: 'orphaned'
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)
    expect(blocks[0]).not.toHaveProperty('secondaryButtonText')
    expect(blocks[0]).not.toHaveProperty('secondaryButtonLink')
  })
})
