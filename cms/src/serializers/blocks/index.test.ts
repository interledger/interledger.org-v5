import { describe, it, expect } from 'vitest'
import { validateContentBlocks } from './index'

describe('validateContentBlocks', () => {
  it('accepts a split-layout image block carrying only the raw upload ID', () => {
    // Mirrors the shape `registerDocumentValidation` middleware sees on
    // create/update: media relations are unpopulated IDs, not { url } objects.
    const err = validateContentBlocks([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-quote',
        media: { image: 42 },
        quote: 'Quoted body.'
      }
    ])

    expect(err).toBeUndefined()
  })

  it('rejects a split-layout image block with no image reference at all', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.split-layout',
        layoutType: 'image-text',
        content: 'Text body.'
      }
    ])

    expect(err).toBeDefined()
  })

  it('accepts an image-block carrying only the raw upload ID', () => {
    const err = validateContentBlocks([
      { __component: 'blocks.image-block', media: { image: 7 } }
    ])

    expect(err).toBeUndefined()
  })

  it('accepts a number-tiles block with at least 2 valid tiles', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.number-tiles',
        tiles: [
          { number: '21', suffix: 'M+', description: 'In Grants' },
          { number: '300', suffix: '+', description: 'Projects' }
        ]
      }
    ])

    expect(err).toBeUndefined()
  })

  it('rejects a number-tiles block with fewer than 2 tiles', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.number-tiles',
        tiles: [{ number: '21', description: 'In Grants' }]
      }
    ])

    expect(err).toBeDefined()
  })

  it('accepts an agenda block with at least two complete items', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.agenda',
        items: [
          {
            time: '8:30 am',
            activity: 'Registration',
            additionalInfo: 'Breakfast is available.'
          },
          {
            time: '9:30 am',
            activity: 'Welcome',
            additionalInfo: 'An overview of the day.'
          }
        ]
      }
    ])

    expect(err).toBeUndefined()
  })

  it('rejects incomplete agenda items with field-level paths', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.agenda',
        items: [
          { time: '8:30 am', activity: 'Registration' },
          { time: '9:30 am', additionalInfo: 'An overview of the day.' }
        ]
      }
    ])

    expect(err?.details.errors.map((error) => error.path)).toEqual([
      ['content', '0', 'items', '0', 'additionalInfo'],
      ['content', '0', 'items', '1', 'activity']
    ])
  })

  it('prefixes a SerializerFieldError path with the content dynamic zone field and the block index, so the admin UI can highlight it', () => {
    const err = validateContentBlocks([
      { __component: 'blocks.paragraph', content: 'First block, valid.' },
      {
        __component: 'blocks.title-card-grid',
        columns: 'Two',
        titleCards: [{}]
      }
    ])

    expect(err?.details.errors[0].path).toEqual(['content', '1', 'ariaLabel'])
  })

  it('collects failing fields from every invalid block in the zone, not just the first', () => {
    const err = validateContentBlocks([
      { __component: 'blocks.paragraph', content: '' },
      {
        __component: 'blocks.title-card-grid',
        columns: 'Two',
        titleCards: [{}]
      }
    ])

    const paths = err?.details.errors.map((e) => e.path)
    expect(paths).toContainEqual(['content', '0'])
    expect(paths).toContainEqual(['content', '1', 'ariaLabel'])
    expect(paths).toContainEqual(['content', '1', 'titleCards', '0', 'heading'])
  })
})
