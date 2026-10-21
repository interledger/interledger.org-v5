import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { serialize } from '../../src/serializers/blocks/timeline.serializer'
import { SerializerFieldError } from '../../src/utils'

import './timelineHandler'

const ctx: ParserContext = { locale: 'en' }

const whitepaper = {
  date: 'Oct 2015',
  description:
    'Evan Schwartz and Stefan Thomas publish the Interledger whitepaper introducing a protocol to route payments across different ledgers.',
  tag: 'Standards / Protocol'
}

const bankOfEngland = {
  date: '2017',
  description:
    'The Bank of England runs an ILP trial between Real-Time Gross Settlement systems.',
  tag: 'Institutional validation'
}

const possibility = {
  heading: 'Possibility',
  subheading: 'Foundation',
  description: 'The Protocol emerges',
  events: [whitepaper, bankOfEngland]
}

const movement = {
  heading: 'Movement',
  subheading: 'Foundation',
  description: 'From protocol to global movement',
  events: [
    {
      date: 'Apr 2021',
      description:
        'The Interledger Foundation incorporates as an independent nonprofit.',
      tag: 'Foundation / Governance'
    }
  ]
}

describe('Timeline round-trip (serialize → parse)', () => {
  it('round-trips one section with several events', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({ sections: [possibility] }),
      ctx
    )

    expect(blocks).toEqual([
      { __component: 'blocks.timeline', sections: [possibility] }
    ])
  })

  it('round-trips several sections in order', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({ sections: [possibility, movement] }),
      ctx
    )

    expect(blocks[0]).toMatchObject({
      sections: [{ heading: 'Possibility' }, { heading: 'Movement' }]
    })
  })

  it('drops Strapi-only fields and surrounding whitespace on the way out', async () => {
    const blocks = await parseMdxToBlocks(
      serialize({
        sections: [
          {
            ...possibility,
            id: 3,
            heading: '  Possibility  ',
            events: [{ ...whitepaper, id: 11, tag: ' Standards / Protocol ' }]
          }
        ]
      }),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.timeline',
        sections: [{ ...possibility, events: [whitepaper] }]
      }
    ])
  })

  it('keeps quotes, braces and non-ASCII text intact', async () => {
    const tricky = {
      ...possibility,
      description: 'A "quoted" {brace} — and an ellipsis…',
      events: [{ ...whitepaper, description: "It's live: 100% → $21M" }]
    }

    const blocks = await parseMdxToBlocks(
      serialize({ sections: [tricky] }),
      ctx
    )

    expect(blocks).toEqual([
      { __component: 'blocks.timeline', sections: [tricky] }
    ])
  })
})

describe('Timeline serializer guards', () => {
  it('refuses a block with no sections, with the field path', () => {
    expect(() => serialize({ sections: [] })).toThrow(SerializerFieldError)
    try {
      serialize({})
    } catch (error) {
      expect(error).toBeInstanceOf(SerializerFieldError)
      expect((error as SerializerFieldError).fieldErrors).toEqual([
        {
          message: 'Timeline block requires at least 1 section',
          path: ['sections']
        }
      ])
    }
  })

  it('collects every failing field across sections and events', () => {
    try {
      serialize({
        sections: [
          { ...possibility, subheading: '' },
          { ...movement, events: [{ ...whitepaper, date: ' ' }] }
        ]
      })
      expect.unreachable('serialize should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SerializerFieldError)
      expect((error as SerializerFieldError).fieldErrors).toEqual([
        {
          message: 'Section 1 is missing its subheading',
          path: ['sections', 0, 'subheading']
        },
        {
          message: 'Section 2, event 1 is missing a date',
          path: ['sections', 1, 'events', 0, 'date']
        }
      ])
    }
  })
})

describe('Timeline parser guards', () => {
  it('rejects a missing sections prop', async () => {
    const result = await parseMdxToBlocks(`<Timeline />`, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      prop: 'sections'
    })
  })

  it('rejects an event missing a required field and says which', async () => {
    const result = await parseMdxToBlocks(
      `<Timeline sections={[{ heading: 'A', subheading: 'B', description: 'C', events: [{ date: '2015', description: 'D' }] }]} />`,
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      component: 'Timeline',
      prop: 'sections',
      message: expect.stringContaining('Section 1, event 1 is missing a tag')
    })
  })

  it('rejects a section with no events', async () => {
    const result = await parseMdxToBlocks(
      `<Timeline sections={[{ heading: 'A', subheading: 'B', description: 'C', events: [] }]} />`,
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(String(result)).toMatch(/Section 1 requires at least 1 event/)
  })

  it('rejects a sections prop that is not an array', async () => {
    const result = await parseMdxToBlocks(
      `<Timeline sections="Possibility" />`,
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ prop: 'sections' })
  })
})
