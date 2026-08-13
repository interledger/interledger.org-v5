import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/cta-buttons.serializer'

// Side-effect import: registers the CtaButtons handler
import './ctaButtonsHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

/** serialize → parse should return the payload it started from. */
const roundTrip = async (
  buttons: Array<Record<string, unknown>>,
  ctx: ParserContext = enCtx
) => parseMdxToBlocks(serialize({ buttons }), ctx)

describe('CtaButtons round-trip (serialize → parse)', () => {
  it('round-trips a single primary button', async () => {
    const buttons = [
      { text: 'Apply now', link: '/grants/apply', style: 'primary' }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips a primary and a secondary, preserving order', async () => {
    const buttons = [
      { text: 'Apply now', link: '/grants/apply', style: 'primary' },
      { text: 'Read the FAQ', link: '/grants/faq', style: 'secondary' }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips two secondaries', async () => {
    const buttons = [
      { text: 'Download pack', link: '/pack.pdf', style: 'secondary' },
      { text: 'Read the FAQ', link: '/grants/faq', style: 'secondary' }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips the external flag', async () => {
    const buttons = [
      {
        text: 'Visit the site',
        link: 'https://example.com',
        style: 'secondary',
        external: true
      }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips the document flag', async () => {
    const buttons = [
      {
        text: 'Theory of change (PDF)',
        link: '/documents/toc.pdf',
        style: 'secondary',
        document: true
      }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips non-ASCII text (es)', async () => {
    const buttons = [
      { text: 'Solicitar ahora', link: '/es/subvenciones', style: 'primary' }
    ]

    expect(await roundTrip(buttons, esCtx)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('round-trips text containing double quotes', async () => {
    const buttons = [
      {
        text: 'Read the "State of the Network"',
        link: '/report',
        style: 'primary'
      }
    ]

    expect(await roundTrip(buttons)).toEqual([
      { __component: 'blocks.cta-buttons', buttons }
    ])
  })

  it('normalises an unset style to primary on the first pass, then is stable', async () => {
    const first = await roundTrip([{ text: 'Apply', link: '/a' }])
    expect(first).toEqual([
      {
        __component: 'blocks.cta-buttons',
        buttons: [{ text: 'Apply', link: '/a', style: 'primary' }]
      }
    ])

    // Feeding the parsed result back through must not change it again.
    const second = await roundTrip(
      (first as Array<{ buttons: Array<Record<string, unknown>> }>)[0].buttons
    )
    expect(second).toEqual(first)
  })

  it('drops false flags rather than round-tripping them', async () => {
    const parsed = await roundTrip([
      {
        text: 'Apply',
        link: '/a',
        style: 'primary',
        external: false,
        document: false
      }
    ])

    expect(parsed).toEqual([
      {
        __component: 'blocks.cta-buttons',
        buttons: [{ text: 'Apply', link: '/a', style: 'primary' }]
      }
    ])
  })
})
