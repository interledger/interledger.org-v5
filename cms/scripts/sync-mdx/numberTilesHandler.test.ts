import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers NumberTiles handler
import './numberTilesHandler'

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('NumberTiles handler', () => {
  it('parses 2 tiles with number, superscript, and description', async () => {
    const blocks = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ number: '21', superscript: 'M+', description: 'In Grants' }, { number: '300', superscript: '+', description: 'Projects supported worldwide' }]} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.number-tiles',
        tiles: [
          { number: '21', superscript: 'M+', description: 'In Grants' },
          {
            number: '300',
            superscript: '+',
            description: 'Projects supported worldwide'
          }
        ]
      }
    ])
  })

  it('parses 4 tiles', async () => {
    const blocks = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ number: '21', description: 'a' }, { number: '300', description: 'b' }, { number: '10', description: 'c' }, { number: '45', description: 'd' }]} />`,
      { locale: 'en' }
    )
    if (blocks instanceof MdxParserError) throw blocks
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.number-tiles',
      tiles: [
        { number: '21', description: 'a' },
        { number: '300', description: 'b' },
        { number: '10', description: 'c' },
        { number: '45', description: 'd' }
      ]
    })
  })

  it('parses more than 4 tiles (overflow is a rendering concern, not a parsing limit)', async () => {
    const tiles = Array.from({ length: 5 }, (_, i) => ({
      number: String(i),
      description: `tile ${i}`
    }))
    const blocks = await parseMdxToBlocks(
      `<NumberTiles tiles={${JSON.stringify(tiles)}} />`,
      { locale: 'en' }
    )
    if (blocks instanceof MdxParserError) throw blocks
    expect(blocks[0]).toMatchObject({ tiles: expect.arrayContaining(tiles) })
  })

  it('omits superscript when absent', async () => {
    const blocks = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ number: '21', description: 'In Grants' }, { number: '300', description: 'Projects' }]} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.number-tiles',
        tiles: [
          { number: '21', description: 'In Grants' },
          { number: '300', description: 'Projects' }
        ]
      }
    ])
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('NumberTiles handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when tiles is missing', async () => {
    const result = await parseMdxToBlocks('<NumberTiles />', { locale: 'en' })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns DYNAMIC_EXPRESSION when tiles is a dynamic expression', async () => {
    const result = await parseMdxToBlocks('<NumberTiles tiles={someVar} />', {
      locale: 'en'
    })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns INVALID_PROP_VALUE when tiles is not an array', async () => {
    const result = await parseMdxToBlocks(
      `<NumberTiles tiles={{ number: '21', description: 'In Grants' }} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a tile entry is missing number', async () => {
    const result = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ description: 'In Grants' }, { number: '300', description: 'Projects' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a tile entry is missing description', async () => {
    const result = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ number: '21' }, { number: '300', description: 'Projects' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when fewer than 2 tiles are provided', async () => {
    const result = await parseMdxToBlocks(
      `<NumberTiles tiles={[{ number: '21', description: 'In Grants' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <NumberTiles> ordering
// ---------------------------------------------------------------------------

describe('NumberTiles handler — mixed content', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Our impact:',
      '',
      `<NumberTiles tiles={[{ number: '21', description: 'In Grants' }, { number: '300', description: 'Projects' }]} />`,
      '',
      'More content after the tiles.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    if (blocks instanceof MdxParserError) throw blocks

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toEqual({
      __component: 'blocks.number-tiles',
      tiles: [
        { number: '21', description: 'In Grants' },
        { number: '300', description: 'Projects' }
      ]
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
