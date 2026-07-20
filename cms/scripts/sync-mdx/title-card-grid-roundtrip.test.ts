import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/title-card-grid.serializer'

// Side-effect import: registers TitleCardGrid handler
import './titleCardGridHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('TitleCardGrid round-trip (serialize → parse)', () => {
  it('round-trips a grid with a single card (en)', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Two' as const,
      titleCards: [
        {
          heading: 'Grant heading',
          description: 'Grant description.',
          secondaryCta: {
            link: '/grants/apply',
            text: 'Learn more',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.title-card-grid', ...original }
    ])
  })

  it('round-trips a grid with a single card (es)', async () => {
    const original = {
      ariaLabel: 'Opciones de subvención',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'Encabezado',
          description: 'Descripción de la subvención.',
          secondaryCta: {
            link: '/es/subvenciones',
            text: 'Más información',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.title-card-grid', ...original }
    ])
  })

  it('round-trips subHeading and an external secondaryCta', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'Grant heading',
          subHeading: 'A subheading',
          description: 'Grant description.',
          secondaryCta: {
            link: 'https://example.com',
            text: 'Learn more',
            external: true
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.title-card-grid', ...original }
    ])
  })

  it('round-trips multiple cards, preserving order', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'First',
          description: 'First description.',
          secondaryCta: {
            link: '/grants/first',
            text: 'Learn more',
            external: false
          }
        },
        {
          heading: 'Second',
          description: 'Second description.',
          secondaryCta: {
            link: '/grants/second',
            text: 'Learn more',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.title-card-grid', ...original }
    ])
  })

  it('preserves brace-escaped content through a round-trip', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'Grant heading',
          description: 'Use {tokens} wisely.',
          secondaryCta: { link: '/grants/apply', text: 'Learn more' }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)
    const [titleCard] = (
      blocks[0] as { titleCards: Array<{ description: string }> }
    ).titleCards
    expect(titleCard.description).toContain('{tokens}')
  })

  it('round-trips attribute values with quotes, ampersands and angle brackets', async () => {
    const original = {
      ariaLabel: 'A & B',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'The "best" offer & <friends>',
          description: 'Body.',
          secondaryCta: {
            link: '/a?x=1&y=2',
            text: 'Read "more"',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.title-card-grid', ...original }
    ])
  })
})
