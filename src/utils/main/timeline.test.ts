import { describe, expect, it } from 'vitest'
import {
  TIMELINE_ACCENT_COUNT,
  resolveTimelineSections,
  timelineAccentIndex,
  timelineEventOffsets
} from './timeline'

const event = {
  date: 'Oct 2015',
  description: 'The Interledger whitepaper is published.',
  tag: 'Standards / Protocol'
}

const section = {
  heading: 'Possibility',
  subheading: 'Foundation',
  description: 'The Protocol emerges',
  events: [event]
}

describe('resolveTimelineSections', () => {
  it('returns complete sections unchanged', () => {
    expect(resolveTimelineSections([section])).toEqual([section])
  })

  it.each([undefined, null, 'sections', {}, 7])(
    'returns no sections for a non-array (%s)',
    (raw) => {
      expect(resolveTimelineSections(raw)).toEqual([])
    }
  )

  it('trims every field', () => {
    expect(
      resolveTimelineSections([
        {
          heading: ' Possibility ',
          subheading: ' Foundation ',
          description: ' The Protocol emerges ',
          events: [
            { date: ' Oct 2015 ', description: ' Published. ', tag: ' Tag ' }
          ]
        }
      ])
    ).toEqual([
      {
        heading: 'Possibility',
        subheading: 'Foundation',
        description: 'The Protocol emerges',
        events: [{ date: 'Oct 2015', description: 'Published.', tag: 'Tag' }]
      }
    ])
  })

  it('skips an event an editor has not finished', () => {
    const result = resolveTimelineSections([
      { ...section, events: [event, { date: '2017', description: '' }, null] }
    ])

    expect(result[0].events).toEqual([event])
  })

  it('skips a section with no complete event', () => {
    expect(
      resolveTimelineSections([{ ...section, events: [{ date: '2017' }] }])
    ).toEqual([])
    expect(resolveTimelineSections([{ ...section, events: [] }])).toEqual([])
    expect(resolveTimelineSections([{ ...section, events: null }])).toEqual([])
  })

  it('skips a section missing a heading, subheading or description', () => {
    expect(
      resolveTimelineSections([
        { ...section, heading: '' },
        { ...section, subheading: null },
        { ...section, description: undefined },
        'Possibility'
      ])
    ).toEqual([])
  })

  it('drops Strapi-only fields such as id', () => {
    expect(
      resolveTimelineSections([
        { ...section, id: 3, events: [{ ...event, id: 11 }] }
      ])
    ).toEqual([section])
  })
})

describe('timelineAccentIndex', () => {
  it('walks the palette in order and wraps', () => {
    const indices = Array.from({ length: TIMELINE_ACCENT_COUNT + 2 }, (_, i) =>
      timelineAccentIndex(i)
    )
    expect(indices).toEqual([
      ...Array.from({ length: TIMELINE_ACCENT_COUNT }, (_, i) => i),
      0,
      1
    ])
  })

  it('falls back to the first accent for a bad index', () => {
    expect(timelineAccentIndex(-1)).toBe(0)
    expect(timelineAccentIndex(1.5)).toBe(0)
    expect(timelineAccentIndex(Number.NaN)).toBe(0)
  })
})

describe('timelineEventOffsets', () => {
  it('returns no offsets for no sections', () => {
    expect(timelineEventOffsets([])).toEqual([])
  })

  it('counts the events before each section', () => {
    const sections = [
      { ...section, events: [event, event] },
      { ...section, events: [event] },
      { ...section, events: [event, event, event] }
    ]
    expect(timelineEventOffsets(sections)).toEqual([0, 2, 3])
  })
})
