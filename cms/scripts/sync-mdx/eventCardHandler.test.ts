import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers EventCard handler
import './eventCardHandler'

const ctx: ParserContext = { locale: 'en' }

const fullCard = `
<EventCard>

<EventWhen title="When?" date="November 8–9, 2025" time="24h" />

<EventWhere title="Where?" location="Mexico City" />

<EventApply title="Apply" buttonText="Apply today" buttonUrl="/grants/apply" />

</EventCard>
`

describe('EventCard handler', () => {
  it('parses a three-column card', async () => {
    const blocks = await parseMdxToBlocks(fullCard, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.event-card',
        when: {
          title: 'When?',
          date: 'November 8–9, 2025',
          time: '24h'
        },
        where: {
          title: 'Where?',
          location: 'Mexico City'
        },
        apply: {
          title: 'Apply',
          primaryCta: {
            text: 'Apply today',
            link: '/grants/apply',
            external: false,
            document: false
          }
        }
      }
    ])
  })

  it('parses a two-column card without Apply', async () => {
    const mdx = `
<EventCard>
  <EventWhen title="When?" date="Tomorrow" />
  <EventWhere title="Where?" location="Online" />
</EventCard>
`
    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.event-card',
      when: { title: 'When?', date: 'Tomorrow' },
      where: { title: 'Where?', location: 'Online' }
    })
    expect(blocks[0]).not.toHaveProperty('apply')
  })

  it('captures optional column text from children', async () => {
    const mdx = `
<EventCard title="Upcoming">
  <EventWhen title="When?" date="Nov 8">
Early arrival for speakers.
  </EventWhen>
  <EventWhere title="Where?">
    Main hall only.
  </EventWhere>
  <EventApply buttonText="Apply today" buttonUrl="/apply">
    Please read the guidelines first.
  </EventApply>
</EventCard>
`
    const blocks = await parseMdxToBlocks(mdx, ctx)
    const block = blocks[0] as {
      title?: string
      when: { text?: string }
      where: { text?: string }
      apply: { text?: string; title?: string }
    }

    expect(block.title).toBe('Upcoming')
    expect(block.when.text).toContain('Early arrival for speakers.')
    expect(block.where.text).toContain('Main hall only.')
    expect(block.apply.text).toContain('Please read the guidelines first.')
    expect(block.apply.title).toBeUndefined()
  })

  it('parses external Apply buttons', async () => {
    const mdx = `
<EventCard>
  <EventWhen title="When?" />
  <EventWhere title="Where?" />
  <EventApply
    title="Register"
    buttonText="Register"
    buttonUrl="https://example.com"
    buttonExternal={true}
  />
</EventCard>
`
    const blocks = await parseMdxToBlocks(mdx, ctx)
    expect(blocks[0]).toMatchObject({
      apply: {
        title: 'Register',
        primaryCta: {
          text: 'Register',
          link: 'https://example.com',
          external: true
        }
      }
    })
  })

  it('errors when EventWhen is missing', async () => {
    const mdx = `
<EventCard>
  <EventWhere title="Where?" />
</EventCard>
`
    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when EventWhen is missing title', async () => {
    const mdx = `
<EventCard>
  <EventWhen date="Nov 8" />
  <EventWhere title="Where?" />
</EventCard>
`
    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when EventWhen title is empty', async () => {
    const mdx = `
<EventCard>
  <EventWhen title="" date="Nov 8" />
  <EventWhere title="Where?" />
</EventCard>
`
    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      prop: 'title',
      component: 'EventWhen'
    })
  })

  it('errors when EventApply buttonUrl is empty', async () => {
    const mdx = `
<EventCard>
  <EventWhen title="When?" />
  <EventWhere title="Where?" />
  <EventApply title="Apply" buttonText="Apply today" buttonUrl="" />
</EventCard>
`
    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      prop: 'buttonUrl',
      component: 'EventApply'
    })
  })
})
