import { describe, expect, it } from 'vitest'
import { serialize } from '../../src/serializers/blocks/agenda.serializer'
import { parseMdxToBlocks } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import './agendaHandler'

const items = [
  {
    time: '8:30 am – 9:30 am',
    activity: '**Registration**',
    additionalInfo: 'Participants arrive and register.'
  },
  {
    time: '9:30 am – 10:00 am',
    activity: 'Welcome',
    additionalInfo: 'An overview of the day.'
  }
]

describe('Agenda handler', () => {
  it('round-trips localized rich text through MDX', async () => {
    const mdx = serialize({ heading: 'Día **1**', items })
    const blocks = await parseMdxToBlocks(mdx, { locale: 'es' })

    expect(blocks).toEqual([
      {
        __component: 'blocks.agenda',
        heading: 'Día **1**',
        items
      }
    ])
  })

  it('supports an agenda without a heading', async () => {
    const blocks = await parseMdxToBlocks(serialize({ items }), {
      locale: 'en'
    })

    expect(blocks).toEqual([{ __component: 'blocks.agenda', items }])
  })

  it('returns MISSING_REQUIRED_PROP when items is missing', async () => {
    const result = await parseMdxToBlocks('<Agenda />', { locale: 'en' })

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('rejects fewer than two items', async () => {
    const result = await parseMdxToBlocks(
      `<Agenda items={${JSON.stringify([items[0]])}} />`,
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('accepts an item without additional information', async () => {
    const optionalItems = [
      { time: '8:30', activity: 'Registration' },
      { time: '9:30', activity: 'Welcome', additionalInfo: 'Overview.' }
    ]
    const blocks = await parseMdxToBlocks(
      `<Agenda items={${JSON.stringify(optionalItems)}} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.agenda',
        items: [
          { time: '8:30', activity: 'Registration' },
          { time: '9:30', activity: 'Welcome', additionalInfo: 'Overview.' }
        ]
      }
    ])
  })

  it('round-trips the intro and the dated days', async () => {
    const days = [
      { date: '2026-10-16', items },
      { date: '2026-10-17', items }
    ]
    const mdx = serialize({ intro: { heading: 'Timetable' }, days })
    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })

    expect(blocks).toEqual([
      {
        __component: 'blocks.agenda',
        intro: { heading: 'Timetable' },
        days
      }
    ])
  })

  it('reads days over a legacy heading and items left beside them', async () => {
    const days = [{ date: '2026-10-16', items }]
    const blocks = await parseMdxToBlocks(
      `<Agenda heading="Friday" items={${JSON.stringify(items)}} days={${JSON.stringify(days)}} />`,
      { locale: 'en' }
    )

    expect(blocks).toEqual([{ __component: 'blocks.agenda', days }])
  })

  it.each([
    ['an empty list', []],
    ['a day without a date', [{ items }]],
    ['a date that is not YYYY-MM-DD', [{ date: 'Friday October 16', items }]],
    ['an impossible date', [{ date: '2026-02-30', items }]],
    ['a day with one item', [{ date: '2026-10-16', items: [items[0]] }]]
  ])('rejects days with %s', async (_label, days) => {
    const result = await parseMdxToBlocks(
      `<Agenda days={${JSON.stringify(days)}} />`,
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'days'
    })
  })
})
