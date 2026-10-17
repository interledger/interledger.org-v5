import { describe, expect, it } from 'vitest'
import type { BlockIntro } from '../../types/blockIntro'
import { normalizeBlockIntro } from './blockIntro'

describe('normalizeBlockIntro', () => {
  it('returns null for a missing intro', () => {
    expect(normalizeBlockIntro(undefined)).toBeNull()
    expect(normalizeBlockIntro(null)).toBeNull()
  })

  it('returns null for an intro with no fields', () => {
    expect(normalizeBlockIntro({})).toBeNull()
  })

  it('returns null when every field is blank', () => {
    expect(
      normalizeBlockIntro({ heading: '  ', subheading: '', description: '\n' })
    ).toBeNull()
  })

  it('keeps a full intro, trimmed', () => {
    expect(
      normalizeBlockIntro({
        heading: ' Our grants ',
        subheading: 'How they work',
        description: 'Read the **rules**.\n'
      })
    ).toEqual({
      heading: 'Our grants',
      subheading: 'How they work',
      description: 'Read the **rules**.'
    })
  })

  it.each<[string, BlockIntro]>([
    ['heading', { heading: 'Heading' }],
    ['subheading', { subheading: 'Subheading' }],
    ['description', { description: 'Description' }]
  ])('keeps an intro that has only a %s', (field, intro) => {
    const normalized = normalizeBlockIntro(intro)
    expect(normalized).not.toBeNull()
    expect(normalized?.[field as keyof BlockIntro]).toBe(
      intro[field as keyof BlockIntro]
    )
  })

  it('sets the missing fields to null', () => {
    expect(normalizeBlockIntro({ heading: 'Heading' })).toEqual({
      heading: 'Heading',
      subheading: null,
      description: null
    })
  })

  it('turns a CKEditor <br/> in the description into a paragraph break', () => {
    expect(
      normalizeBlockIntro({ description: 'One<br />Two<br/>Three<BR>Four' })
        ?.description
    ).toBe('One\n\nTwo\n\nThree\n\nFour')
  })

  it('treats a description of only break tags as empty', () => {
    expect(normalizeBlockIntro({ description: ' <br /> <br/> ' })).toBeNull()
  })

  it('treats a non-string field as empty', () => {
    const malformed = {
      heading: 42,
      description: ['x']
    } as unknown as BlockIntro
    expect(normalizeBlockIntro(malformed)).toBeNull()
  })

  it('treats a non-object intro as empty', () => {
    expect(normalizeBlockIntro('Heading' as unknown as BlockIntro)).toBeNull()
  })
})
