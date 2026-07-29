import { describe, it, expect } from 'vitest'
import { serialize } from './footer-notes.serializer'

describe('footer-notes serializer', () => {
  it('serializes notes with text, linkText, and linkUrl', () => {
    const result = serialize({
      notes: [
        {
          text: 'Average cost to send 1 USDT on August 5, 2025 per GasFeesNow.',
          linkText: 'https://gasfeesnow.com',
          linkUrl: 'https://gasfeesnow.com'
        },
        {
          text: 'Average price for a $200 bank initiated cross-border transfer.',
          linkText: 'World Bank remittance prices',
          linkUrl: 'https://remittanceprices.worldbank.org'
        }
      ]
    })

    expect(result).toContain(
      'notes={[{"text":"Average cost to send 1 USDT on August 5, 2025 per GasFeesNow.","linkText":"https://gasfeesnow.com","linkUrl":"https://gasfeesnow.com"},' +
        '{"text":"Average price for a $200 bank initiated cross-border transfer.","linkText":"World Bank remittance prices","linkUrl":"https://remittanceprices.worldbank.org"}]}'
    )
  })

  it('omits linkText/linkUrl when absent', () => {
    const result = serialize({
      notes: [{ text: 'A plain citation with no source link.' }]
    })

    expect(result).toContain(
      'notes={[{"text":"A plain citation with no source link."}]}'
    )
  })

  it('drops a half-filled link pair (linkText without linkUrl)', () => {
    const result = serialize({
      notes: [{ text: 'Citation.', linkText: 'Some source' }]
    })

    expect(result).toContain('notes={[{"text":"Citation."}]}')
  })

  it('drops a half-filled link pair (linkUrl without linkText)', () => {
    const result = serialize({
      notes: [{ text: 'Citation.', linkUrl: 'https://example.com' }]
    })

    expect(result).toContain('notes={[{"text":"Citation."}]}')
  })

  it('throws when notes is missing', () => {
    expect(() => serialize({})).toThrow(
      'Footer Notes block requires at least 1 note'
    )
  })

  it('throws when notes is empty', () => {
    expect(() => serialize({ notes: [] })).toThrow(
      'Footer Notes block requires at least 1 note'
    )
  })

  it('throws when a note is missing text', () => {
    expect(() =>
      serialize({
        notes: [{ text: 'First note.' }, { linkText: 'x', linkUrl: 'y' }]
      })
    ).toThrow('Footer Notes block: note 2 is missing text')
  })
})
