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
        image: 42,
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
      { __component: 'blocks.image-block', image: 7 }
    ])

    expect(err).toBeUndefined()
  })

  it('accepts a number-tiles block with at least 2 valid tiles', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.number-tiles',
        tiles: [
          { number: '21', superscript: 'M+', description: 'In Grants' },
          { number: '300', superscript: '+', description: 'Projects' }
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
})
