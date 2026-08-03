import { describe, it, expect } from 'vitest'
import { serialize } from './info-card-grid.serializer'
import { SerializerFieldError } from '../../utils'

describe('info-card-grid serializer', () => {
  it('serializes a two-column grid as CardGrid variant Info', () => {
    const result = serialize({
      ariaLabel: 'Program info',
      columns: 'Two',
      cards: [
        {
          heading: 'Why apply',
          body: '- Point 1\n- Point 2'
        },
        {
          heading: 'Who can apply',
          body: 'Open to everyone.'
        }
      ]
    })

    expect(result).toBe(
      [
        '<CardGrid ariaLabel="Program info" variant="Info" columns="Two">',
        '<InfoCard heading="Why apply">',
        '',
        '- Point 1',
        '- Point 2',
        '',
        '</InfoCard>',
        '<InfoCard heading="Who can apply">',
        '',
        'Open to everyone.',
        '',
        '</InfoCard>',
        '</CardGrid>'
      ].join('\n')
    )
  })

  it('escapes quotes in headings', () => {
    const result = serialize({
      ariaLabel: 'Program info',
      columns: 'Three',
      cards: [{ heading: 'Say "hello"', body: 'Body' }]
    })

    expect(result).toContain('heading="Say &quot;hello&quot;"')
  })

  it('throws when ariaLabel is missing', () => {
    expect(() =>
      serialize({
        columns: 'Two',
        cards: [{ heading: 'A', body: 'B' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when columns is invalid', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Program info',
        columns: 'Four',
        cards: [{ heading: 'A', body: 'B' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when cards are missing', () => {
    expect(() =>
      serialize({ ariaLabel: 'Program info', columns: 'Two', cards: [] })
    ).toThrow(SerializerFieldError)
  })

  it('throws when a card is missing heading or body', () => {
    expect(() =>
      serialize({
        ariaLabel: 'Program info',
        columns: 'Two',
        cards: [{ heading: '', body: '' }]
      })
    ).toThrow(SerializerFieldError)
  })
})
