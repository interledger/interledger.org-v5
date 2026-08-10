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

  it('accepts a full event-card block with When, Where, and Apply', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.event-card',
        when: { title: 'When?', date: 'Nov 8–9', time: '24h' },
        where: { title: 'Where?', location: 'Mexico City' },
        apply: {
          title: 'Apply',
          primaryCta: { text: 'Apply today', link: '/grants' }
        }
      }
    ])

    expect(err).toBeUndefined()
  })

  it('rejects an event-card missing the When title with a content-zone path', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.event-card',
        when: { title: '' },
        where: { title: 'Where?' }
      }
    ])

    expect(err?.details.errors.map((error) => error.path)).toContainEqual([
      'content',
      '0',
      'when',
      'title'
    ])
  })

  it('prefixes a SerializerFieldError path with the content dynamic zone field and the block index, so the admin UI can highlight it', () => {
    const err = validateContentBlocks([
      { __component: 'blocks.paragraph', content: 'First block, valid.' },
      {
        __component: 'blocks.card-grid',
        variant: 'Title',
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
        __component: 'blocks.card-grid',
        variant: 'Title',
        columns: 'Two',
        titleCards: [{}]
      }
    ])

    const paths = err?.details.errors.map((e) => e.path)
    expect(paths).toContainEqual(['content', '0'])
    expect(paths).toContainEqual(['content', '1', 'ariaLabel'])
    expect(paths).toContainEqual(['content', '1', 'titleCards', '0', 'heading'])
  })

  it('rejects a Resource card grid with fewer than two cards on save (edit-time gate)', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.card-grid',
        ariaLabel: 'Resources',
        variant: 'Resource',
        columns: 'Two',
        resourceCards: [
          {
            heading: 'Only one',
            description: 'Needs a sibling.',
            secondaryCta: { link: '/a', text: 'Open' }
          }
        ]
      }
    ])

    expect(err).toBeDefined()
    expect(err?.message).toMatch(/at least two cards/i)
  })

  it('rejects One column for a non-Navigation card grid on save', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.card-grid',
        ariaLabel: 'Info',
        variant: 'Info',
        columns: 'One',
        infoCards: [{ heading: 'Why', body: 'Because.' }]
      }
    ])

    expect(err).toBeDefined()
    expect(err?.message).toMatch(/Navigation/i)
  })

  it('accepts a report-section block with a heading and typed content blocks', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.report-section',
        heading: 'Introduction',
        reportText: [
          { textType: 'Paragraph', textContent: 'The full report body.' },
          { textType: 'Disclaimer', textDisclaimer: 'For informational use.' }
        ]
      }
    ])

    expect(err).toBeUndefined()
  })

  it('rejects a report-section block missing its heading and reportText content, with field-level paths', () => {
    const err = validateContentBlocks([
      {
        __component: 'blocks.report-section',
        reportText: [{ textType: 'Paragraph', textContent: '' }]
      }
    ])

    expect(err?.details.errors.map((error) => error.path)).toEqual([
      ['content', '0', 'heading'],
      ['content', '0', 'reportText', '0', 'textContent']
    ])
  })
})
