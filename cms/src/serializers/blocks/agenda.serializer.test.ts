import { describe, expect, it } from 'vitest'
import { SerializerFieldError } from '../../utils'
import { serialize } from './agenda.serializer'

const validItems = [
  {
    time: '8:30 am – 9:30 am',
    activity: 'Registration',
    additionalInfo: 'Participants arrive and register.'
  },
  {
    time: '9:30 am – 10:00 am',
    activity: 'Welcome',
    additionalInfo: 'An overview of the day.'
  }
]

describe('agenda serializer', () => {
  it('serializes an optional heading and rich-text item values', () => {
    const result = serialize({
      heading: '<p>Day <strong>1</strong></p>',
      items: validItems
    })

    expect(result).toContain('heading={"Day **1**"}')
    expect(result).toContain(`items={${JSON.stringify(validItems)}}`)
  })

  it('promotes a stray <br/> to a paragraph break — Agenda.astro has no MDX-children fallback', () => {
    const result = serialize({
      heading: 'Day one<br/>Day two',
      items: validItems
    })

    expect(result).toContain('heading={"Day one\\n\\nDay two"}')
  })

  it('omits the heading when it is empty', () => {
    const result = serialize({ items: validItems })

    expect(result).not.toContain('heading=')
  })

  it('requires at least two items', () => {
    expect(() => serialize({ items: [validItems[0]!] })).toThrow(
      'Agenda block requires at least 2 items'
    )
  })

  it('reports every missing required item field', () => {
    try {
      serialize({ items: [{}, {}] })
      expect.unreachable('Expected agenda serialization to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(SerializerFieldError)
      expect(
        (error as SerializerFieldError).fieldErrors.map(({ path }) => path)
      ).toEqual([
        ['items', 0, 'time'],
        ['items', 0, 'activity'],
        ['items', 1, 'time'],
        ['items', 1, 'activity']
      ])
    }
  })

  it('omits empty additional information', () => {
    const result = serialize({
      items: [
        { time: '8:30 am', activity: 'Registration' },
        {
          time: '9:30 am',
          activity: 'Welcome',
          additionalInfo: 'An overview of the day.'
        }
      ]
    })

    expect(result).toContain(
      JSON.stringify([
        { time: '8:30 am', activity: 'Registration' },
        {
          time: '9:30 am',
          activity: 'Welcome',
          additionalInfo: 'An overview of the day.'
        }
      ])
    )
  })
})
