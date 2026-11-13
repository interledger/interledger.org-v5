import { describe, expect, it } from 'vitest'
import { normalizeBlockIntroForMdx, serializeIntroProp } from './blockIntro'

describe('normalizeBlockIntroForMdx', () => {
  it('returns null for a missing intro', () => {
    expect(normalizeBlockIntroForMdx(undefined)).toBeNull()
    expect(normalizeBlockIntroForMdx(null)).toBeNull()
  })

  it('returns null when every field is empty or null', () => {
    expect(
      normalizeBlockIntroForMdx({
        heading: '  ',
        subheading: null,
        description: ''
      })
    ).toBeNull()
  })

  it('drops empty fields and trims the rest', () => {
    expect(
      normalizeBlockIntroForMdx({
        heading: ' Heading ',
        subheading: '',
        description: null
      })
    ).toEqual({ heading: 'Heading' })
  })

  it('keeps a heading as plain text, never converting it to markdown', () => {
    expect(
      normalizeBlockIntroForMdx({ heading: 'snake_case & *star*' })
    ).toEqual({
      heading: 'snake_case & *star*'
    })
  })

  it('converts a CKEditor description to markdown', () => {
    expect(
      normalizeBlockIntroForMdx({
        description: '<p>Read the <strong>rules</strong>.</p>'
      })
    ).toEqual({ description: 'Read the **rules**.' })
  })

  it('turns a <br/> in the description into a paragraph break', () => {
    expect(normalizeBlockIntroForMdx({ description: 'One<br/>Two' })).toEqual({
      description: 'One\n\nTwo'
    })
  })
})

describe('serializeIntroProp', () => {
  it('writes nothing for an empty intro', () => {
    expect(serializeIntroProp(undefined)).toBe('')
    expect(serializeIntroProp(null)).toBe('')
    expect(serializeIntroProp({ heading: '', subheading: null })).toBe('')
  })

  it('writes only the fields that have content', () => {
    expect(
      serializeIntroProp({ heading: 'Our grants', subheading: null })
    ).toBe(' intro={{"heading":"Our grants"}}')
  })

  it('writes a full intro in field order', () => {
    expect(
      serializeIntroProp({
        description: 'Text',
        subheading: 'Sub',
        heading: 'Heading'
      })
    ).toBe(
      ' intro={{"heading":"Heading","subheading":"Sub","description":"Text"}}'
    )
  })

  it('leaves braces as they are', () => {
    expect(serializeIntroProp({ heading: 'a } b {' })).toBe(
      ' intro={{"heading":"a } b {"}}'
    )
  })
})
