import { describe, it, expect } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { parseMdxToBlocks } from './mdxBlockParser'

// Side-effect import: registers the InfoCards handler
import './infoCardsHandler'

describe('InfoCards handler', () => {
  it('parses a two-column grid with InfoCard children', async () => {
    const mdx = [
      '<InfoCards ariaLabel="Program info" columns="Two">',
      '  <InfoCard heading="Why apply">',
      '  - Point 1',
      '  - Point 2',
      '  </InfoCard>',
      '  <InfoCard heading="Who can apply">',
      '  Open to everyone.',
      '  </InfoCard>',
      '</InfoCards>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })

    expect(blocks).toEqual([
      {
        __component: 'blocks.card-grid',
        ariaLabel: 'Program info',
        variant: 'Info',
        columns: 'Two',
        infoCards: [
          {
            heading: 'Why apply',
            body: '- Point 1\n- Point 2'
          },
          {
            heading: 'Who can apply',
            body: 'Open to everyone.'
          }
        ]
      }
    ])
  })

  it('defaults columns to Three when omitted', async () => {
    const blocks = await parseMdxToBlocks(
      '<InfoCards ariaLabel="Program info"><InfoCard heading="A">Body</InfoCard></InfoCards>',
      { locale: 'en' }
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.card-grid',
      variant: 'Info',
      columns: 'Three'
    })
  })

  it('returns INVALID_PROP_VALUE for bad columns', async () => {
    const result = await parseMdxToBlocks(
      '<InfoCards ariaLabel="Program info" columns="Four"><InfoCard heading="A">Body</InfoCard></InfoCards>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns an error when InfoCard children are missing', async () => {
    const result = await parseMdxToBlocks(
      '<InfoCards ariaLabel="Program info" columns="Two" />',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
  })

  it('returns an error when an InfoCard has empty body', async () => {
    const result = await parseMdxToBlocks(
      '<InfoCards ariaLabel="Program info"><InfoCard heading="A"></InfoCard></InfoCards>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns MISSING_REQUIRED_PROP when ariaLabel is absent', async () => {
    const result = await parseMdxToBlocks(
      '<InfoCards columns="Two"><InfoCard heading="A">Body</InfoCard></InfoCards>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns INVALID_PROP_VALUE when a heading prop is present (unsupported)', async () => {
    const result = await parseMdxToBlocks(
      '<InfoCards ariaLabel="Program info" heading="Our programs"><InfoCard heading="A">Body</InfoCard></InfoCards>',
      { locale: 'en' }
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'heading'
    })
  })
})
