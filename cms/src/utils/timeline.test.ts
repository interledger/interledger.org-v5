import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  TimelineFieldError,
  normalizeTimelineSections,
  validateTimelineSections
} from './timeline'

const event = {
  date: 'Oct 2015',
  description:
    'Evan Schwartz and Stefan Thomas publish the Interledger whitepaper.',
  tag: 'Standards / Protocol'
}

const section = {
  heading: 'Possibility',
  subheading: 'Foundation',
  description: 'The Protocol emerges',
  events: [event]
}

function contentComponents(contentType: string): string[] {
  const schemaPath = fileURLToPath(
    new URL(
      `../api/${contentType}/content-types/${contentType}/schema.json`,
      import.meta.url
    )
  )
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  return schema.attributes.content.components
}

describe('validateTimelineSections', () => {
  it('accepts a complete timeline', () => {
    expect(validateTimelineSections([section])).toEqual([])
  })

  it.each([undefined, null, 'sections', {}, []])(
    'requires at least one section (%s)',
    (raw) => {
      expect(validateTimelineSections(raw)).toEqual([
        {
          message: 'Timeline block requires at least 1 section',
          path: ['sections']
        }
      ])
    }
  )

  it('names every missing section field with its path', () => {
    const errors = validateTimelineSections([
      { ...section, heading: '  ', subheading: null }
    ])

    expect(errors).toEqual([
      {
        message: 'Section 1 is missing its heading',
        path: ['sections', 0, 'heading']
      },
      {
        message: 'Section 1 is missing its subheading',
        path: ['sections', 0, 'subheading']
      }
    ])
  })

  it('requires at least one event per section', () => {
    expect(validateTimelineSections([{ ...section, events: [] }])).toEqual([
      {
        message: 'Section 1 requires at least 1 event',
        path: ['sections', 0, 'events']
      }
    ])
  })

  it('reports section fields and the empty event list together', () => {
    const errors = validateTimelineSections([
      { ...section, description: '', events: undefined }
    ])

    expect(errors.map((e) => e.message)).toEqual([
      'Section 1 is missing a description',
      'Section 1 requires at least 1 event'
    ])
  })

  it('names the failing event with a path into the section', () => {
    const errors = validateTimelineSections([
      section,
      { ...section, events: [event, { ...event, date: '', tag: undefined }] }
    ])

    expect(errors).toEqual([
      {
        message: 'Section 2, event 2 is missing a date',
        path: ['sections', 1, 'events', 1, 'date']
      },
      {
        message: 'Section 2, event 2 is missing a tag',
        path: ['sections', 1, 'events', 1, 'tag']
      }
    ])
  })

  it('rejects a section or event that is not an object', () => {
    expect(
      validateTimelineSections(['Possibility', { ...section, events: [42] }])
    ).toEqual([
      { message: 'Section 1 is not a section', path: ['sections', 0] },
      {
        message: 'Section 2, event 1 is not an event',
        path: ['sections', 1, 'events', 0]
      }
    ])
  })
})

describe('normalizeTimelineSections', () => {
  it('trims every field and drops nothing', () => {
    const result = normalizeTimelineSections([
      {
        heading: ' Possibility ',
        subheading: ' Foundation ',
        description: ' The Protocol emerges ',
        events: [
          {
            date: ' Oct 2015 ',
            description: ' Published. ',
            tag: ' Standards '
          }
        ]
      }
    ])

    expect(result).toEqual([
      {
        heading: 'Possibility',
        subheading: 'Foundation',
        description: 'The Protocol emerges',
        events: [
          { date: 'Oct 2015', description: 'Published.', tag: 'Standards' }
        ]
      }
    ])
  })

  it('strips unknown fields so Strapi never sees them', () => {
    const result = normalizeTimelineSections([
      { ...section, id: 7, events: [{ ...event, id: 9 }] }
    ])

    expect(result).toEqual([section])
  })

  it('returns every failing field as one error', () => {
    const result = normalizeTimelineSections([
      { ...section, heading: '', events: [{ ...event, tag: '' }] }
    ])

    expect(result).toBeInstanceOf(TimelineFieldError)
    if (!(result instanceof TimelineFieldError)) return
    expect(result.fieldErrors).toHaveLength(2)
    expect(result.message).toBe(
      'Section 1 is missing its heading; Section 1, event 1 is missing a tag'
    )
  })
})

describe('Timeline availability', () => {
  it('is only on a Foundation Page for now', () => {
    expect(contentComponents('foundation-page')).toContain('blocks.timeline')
    for (const contentType of [
      'summit-page',
      'hackathon-page',
      'grant-overview-page',
      'fundraising-page'
    ]) {
      expect(contentComponents(contentType)).not.toContain('blocks.timeline')
    }
  })
})
