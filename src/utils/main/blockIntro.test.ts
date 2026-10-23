import { describe, expect, it } from 'vitest'
import type { BlockIntroData } from '../../types/blockIntro'
import {
  blockIntroA11y,
  blockIntroLabel,
  normalizeBlockIntro,
  resolveBlockIntro,
  splitTrailingHeading
} from './blockIntro'

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

  it.each<[string, BlockIntroData]>([
    ['heading', { heading: 'Heading' }],
    ['subheading', { subheading: 'Subheading' }],
    ['description', { description: 'Description' }]
  ])('keeps an intro that has only a %s', (field, intro) => {
    const normalized = normalizeBlockIntro(intro)
    expect(normalized).not.toBeNull()
    expect(normalized?.[field as keyof BlockIntroData]).toBe(
      intro[field as keyof BlockIntroData]
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
    } as unknown as BlockIntroData
    expect(normalizeBlockIntro(malformed)).toBeNull()
  })

  it('treats a non-object intro as empty', () => {
    expect(
      normalizeBlockIntro('Heading' as unknown as BlockIntroData)
    ).toBeNull()
  })
})

describe('resolveBlockIntro', () => {
  it('prefers an intro with content over the legacy heading', () => {
    expect(resolveBlockIntro({ subheading: 'Sub' }, 'Old')).toEqual({
      heading: null,
      subheading: 'Sub',
      description: null
    })
  })

  it('falls back to the legacy heading', () => {
    expect(resolveBlockIntro({ heading: ' ' }, ' Old ')).toEqual({
      heading: 'Old',
      subheading: null,
      description: null
    })
    expect(resolveBlockIntro(undefined, 'Old')?.heading).toBe('Old')
  })

  it('returns null when neither has content', () => {
    expect(resolveBlockIntro(null, '')).toBeNull()
    expect(resolveBlockIntro(undefined, undefined)).toBeNull()
  })
})

describe('blockIntroLabel', () => {
  it('uses the heading, then the subheading', () => {
    expect(
      blockIntroLabel(normalizeBlockIntro({ heading: 'H', subheading: 'S' }))
    ).toBe('H')
    expect(blockIntroLabel(normalizeBlockIntro({ subheading: 'S' }))).toBe('S')
  })

  it('returns null without a heading or subheading', () => {
    expect(
      blockIntroLabel(normalizeBlockIntro({ description: 'D' }))
    ).toBeNull()
    expect(blockIntroLabel(null)).toBeNull()
  })
})

describe('splitTrailingHeading', () => {
  it('splits a trailing h2 off the body', () => {
    expect(
      splitTrailingHeading('Intro text.\n\n\n\n## Explore our Series  \n')
    ).toEqual({ body: 'Intro text.', heading: 'Explore our Series' })
  })

  it('drops closing hashes and handles a heading-only text', () => {
    expect(splitTrailingHeading('## Series ##')).toEqual({
      body: '',
      heading: 'Series'
    })
  })

  it('leaves markdown that does not end on an h2 alone', () => {
    for (const markdown of [
      'Text.\n\n## Heading\n\nMore.',
      '### Small',
      'Text'
    ]) {
      expect(splitTrailingHeading(markdown)).toEqual({
        body: markdown,
        heading: null
      })
    }
  })
})

describe('blockIntroA11y', () => {
  it('labels the section by the intro heading with a random id', () => {
    const intro = normalizeBlockIntro({ heading: 'Same heading' })
    const first = blockIntroA11y(intro, 'card-grid', 'Cards')
    const second = blockIntroA11y(intro, 'card-grid', 'Cards')

    expect(first.headingId).toMatch(/^card-grid-heading-[0-9a-f-]{36}$/)
    expect(second.headingId).not.toBe(first.headingId)
    expect(first.ariaLabel).toBeUndefined()
  })

  it('labels by the subheading when there is no heading', () => {
    const a11y = blockIntroA11y(
      normalizeBlockIntro({ subheading: 'Sub' }),
      'faq'
    )
    expect(a11y.headingId).toMatch(/^faq-heading-/)
  })

  it('falls back to the given label without a heading or subheading', () => {
    expect(
      blockIntroA11y(normalizeBlockIntro({ description: 'Text' }), 'faq', 'FAQ')
    ).toEqual({ headingId: undefined, ariaLabel: 'FAQ' })
    expect(blockIntroA11y(null, 'number-tiles')).toEqual({
      headingId: undefined,
      ariaLabel: undefined
    })
  })
})
