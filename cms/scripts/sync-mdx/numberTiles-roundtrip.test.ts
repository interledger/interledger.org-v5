import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/number-tiles.serializer'

// Side-effect import: registers NumberTiles handler
import './numberTilesHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('NumberTiles round-trip (serialize → parse)', () => {
  it('round-trips tiles with suffix (en)', async () => {
    const original = {
      tiles: [
        { number: '21', suffix: 'M+', description: 'In Grants' },
        {
          number: '300',
          suffix: '+',
          description: 'Projects supported worldwide'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.number-tiles', tiles: original.tiles }
    ])
  })

  it('round-trips tiles without suffix (es)', async () => {
    const original = {
      tiles: [
        { number: '1000', description: 'Participantes' },
        { number: '45', description: 'Países representados' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.number-tiles', tiles: original.tiles }
    ])
  })

  it('round-trips four tiles (overflow row layout data)', async () => {
    const original = {
      tiles: [
        { number: '21', description: 'In Grants' },
        { number: '300', description: 'Projects' },
        { number: '10', description: 'Years' },
        { number: '45', description: 'Countries' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([
      { __component: 'blocks.number-tiles', tiles: original.tiles }
    ])
  })
})
