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
})
