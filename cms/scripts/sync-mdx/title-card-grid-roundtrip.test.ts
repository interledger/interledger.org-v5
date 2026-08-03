import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/title-card-grid.serializer'

// Side-effect import: registers TitleCardGrid handler (emits card-grid)
import './titleCardGridHandler'
// Serialize emits <CardGrid>, so the CardGrid handler must also be registered
import './cardGridHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

function toCardGridBlock(original: {
  ariaLabel: string
  columns: 'Two' | 'Three'
  titleCards: Array<{
    heading: string
    subHeading?: string
    description: string
    secondaryCta: {
      link: string
      text: string
      external?: boolean
      document?: boolean
    }
  }>
}) {
  return {
    __component: 'blocks.card-grid' as const,
    ariaLabel: original.ariaLabel,
    variant: 'Title' as const,
    columns: original.columns,
    titleCards: original.titleCards.map((card) => ({
      heading: card.heading,
      ...(card.subHeading !== undefined ? { subHeading: card.subHeading } : {}),
      description: card.description,
      secondaryCta: {
        link: card.secondaryCta.link,
        text: card.secondaryCta.text,
        external: card.secondaryCta.external ?? false,
        document: card.secondaryCta.document ?? false
      }
    }))
  }
}

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

    expect(blocks).toEqual([toCardGridBlock(original)])
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

    expect(blocks).toEqual([toCardGridBlock(original)])
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

    expect(blocks).toEqual([toCardGridBlock(original)])
  })

  it('round-trips multiple cards in order', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'First',
          description: 'First description.',
          secondaryCta: {
            link: '/one',
            text: 'One',
            external: false
          }
        },
        {
          heading: 'Second',
          description: 'Second description.',
          secondaryCta: {
            link: '/two',
            text: 'Two',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([toCardGridBlock(original)])
  })

  it('round-trips escaped braces in description', async () => {
    const original = {
      ariaLabel: 'Grant options',
      columns: 'Three' as const,
      titleCards: [
        {
          heading: 'Grant heading',
          description: 'Use {curly} braces.',
          secondaryCta: {
            link: '/grants/apply',
            text: 'Learn more',
            external: false
          }
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([toCardGridBlock(original)])
  })
})
