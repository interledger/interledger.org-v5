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
  it('serializes an optional CKEditor heading and plain item values', () => {
    const result = serialize({
      heading: '<p>Day <strong>1</strong></p>',
      items: validItems
    })

    expect(result).toContain('heading={"Day **1**"}')
    expect(result).toContain(`items={${JSON.stringify(validItems)}}`)
  })

  it('promotes a stray <br/> in heading to a markdown hard line break — Agenda.astro renders it via parseMarkdownInline', () => {
    const result = serialize({
      heading: 'Day one<br/>Day two',
      items: validItems
    })

    expect(result).toContain('heading={"Day one  \\nDay two"}')
  })

  it('promotes a hard Enter (two <p>s) in heading to the same markdown hard line break as a <br/>', () => {
    const result = serialize({
      heading: '<p>Day one</p><p>Day two</p>',
      items: validItems
    })

    expect(result).toContain('heading={"Day one  \\nDay two"}')
  })

  it('promotes a stray <br/> in additionalInfo to a paragraph break — Agenda.astro renders it via parseMarkdown', () => {
    const result = serialize({
      items: [
        {
          time: validItems[0]!.time,
          activity: validItems[0]!.activity,
          additionalInfo: 'Day one<br/>Day two'
        },
        validItems[1]!
      ]
    })

    expect(result).toContain('"additionalInfo":"Day one\\n\\nDay two"')
  })

  it('trims time and activity and converts pasted HTML to markdown', () => {
    const result = serialize({
      items: [
        {
          time: '  8:30 am – 9:30 am  ',
          activity: '  <p>Day <strong>one</strong></p>  '
        },
        validItems[1]!
      ]
    })

    expect(result).toContain(
      JSON.stringify([
        { time: '8:30 am – 9:30 am', activity: 'Day **one**' },
        validItems[1]
      ])
    )
  })

  it('does not promote a stray <br/> in time or activity — they are plain strings, unlike heading/additionalInfo', () => {
    const result = serialize({
      items: [
        { time: '8:30 am', activity: 'Day one<br/>Day two' },
        validItems[1]!
      ]
    })

    expect(result).toContain(
      JSON.stringify([
        { time: '8:30 am', activity: 'Day one<br/>Day two' },
        validItems[1]
      ])
    )
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
