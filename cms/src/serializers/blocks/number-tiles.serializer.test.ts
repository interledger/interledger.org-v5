import { describe, it, expect } from 'vitest'
import { serialize } from './number-tiles.serializer'

describe('number-tiles serializer', () => {
  it('serializes tiles with number, superscript, and description', () => {
    const result = serialize({
      tiles: [
        { number: '21', superscript: 'M+', description: 'In Grants' },
        {
          number: '300',
          superscript: '+',
          description: 'Projects supported worldwide'
        }
      ]
    })

    expect(result).toContain(
      'tiles={[{"number":"21","superscript":"M+","description":"In Grants"},' +
        '{"number":"300","superscript":"+","description":"Projects supported worldwide"}]}'
    )
  })

  it('omits superscript when absent', () => {
    const result = serialize({
      tiles: [
        { number: '21', description: 'In Grants' },
        { number: '300', description: 'Projects supported worldwide' }
      ]
    })

    expect(result).toContain(
      'tiles={[{"number":"21","description":"In Grants"},' +
        '{"number":"300","description":"Projects supported worldwide"}]}'
    )
  })

  it('throws when tiles is missing', () => {
    expect(() => serialize({})).toThrow(
      'Number Tiles block requires at least 2 tiles'
    )
  })

  it('throws when fewer than 2 tiles are present', () => {
    expect(() =>
      serialize({ tiles: [{ number: '21', description: 'In Grants' }] })
    ).toThrow('Number Tiles block requires at least 2 tiles')
  })

  it('throws when a tile is missing a number', () => {
    expect(() =>
      serialize({
        tiles: [
          { number: '21', description: 'In Grants' },
          { description: 'Projects supported worldwide' }
        ]
      })
    ).toThrow('Number Tiles block: tile 2 is missing a number')
  })

  it('throws when a tile is missing a description', () => {
    expect(() =>
      serialize({
        tiles: [
          { number: '21', description: 'In Grants' },
          { number: '300' }
        ]
      })
    ).toThrow('Number Tiles block: tile 2 is missing a description')
  })
})
