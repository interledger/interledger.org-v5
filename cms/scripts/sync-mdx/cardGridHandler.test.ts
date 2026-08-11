import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

import './cardGridHandler'

const ctx: ParserContext = { locale: 'en' }

describe('CardGrid handler', () => {
  it('parses a Title variant grid', async () => {
    const mdx = [
      '<CardGrid ariaLabel="Grant options" variant="Title" columns="Two">',
      '<TitleCard heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more" buttonExternal={false}>',
      'Grant description.',
      '</TitleCard>',
      '</CardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.card-grid',
        ariaLabel: 'Grant options',
        variant: 'Title',
        columns: 'Two',
        titleCards: [
          {
            heading: 'Grant heading',
            description: 'Grant description.',
            secondaryCta: {
              link: '/grants/apply',
              text: 'Learn more',
              external: false,
              document: false
            }
          }
        ]
      }
    ])
  })

  it('parses Resource, Info, and Navigation variants', async () => {
    const resource = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Resources" variant="Resource" columns="Two">',
        '<ResourceCard heading="A" buttonUrl="/a" buttonText="Open" buttonDocument={true}>',
        'Desc A',
        '</ResourceCard>',
        '<ResourceCard heading="B" buttonUrl="/b" buttonText="Open">',
        'Desc B',
        '</ResourceCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(resource[0]).toMatchObject({
      __component: 'blocks.card-grid',
      variant: 'Resource',
      resourceCards: [
        expect.objectContaining({
          secondaryCta: expect.objectContaining({ document: true })
        }),
        expect.objectContaining({ heading: 'B' })
      ]
    })

    const info = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Info" variant="Info" columns="Three">',
        '<InfoCard heading="Why">Body</InfoCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(info[0]).toMatchObject({
      variant: 'Info',
      infoCards: [{ heading: 'Why', body: 'Body' }]
    })

    const nav = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Nav" variant="Navigation" columns="One">',
        '<NavigationCard heading="Go" buttonUrl="/go" buttonText="Next" />',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(nav[0]).toMatchObject({
      variant: 'Navigation',
      columns: 'One',
      navigationCards: [{ heading: 'Go' }]
    })
  })

  it('rejects One column for non-Navigation', async () => {
    const result = await parseMdxToBlocks(
      '<CardGrid ariaLabel="Info" variant="Info" columns="One"><InfoCard heading="A">B</InfoCard></CardGrid>',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })

  it('rejects Resource with a single card', async () => {
    const result = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Resources" variant="Resource" columns="Two">',
        '<ResourceCard heading="A" buttonUrl="/a" buttonText="Open">Desc</ResourceCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
  })

  it('rejects a card of the wrong type inside a variant grid', async () => {
    const result = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Info" variant="Info" columns="Three">',
        '<InfoCard heading="A">Body</InfoCard>',
        '<TitleCard heading="B" buttonUrl="/b" buttonText="Open" buttonExternal={false}>',
        'Desc',
        '</TitleCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNSUPPORTED_COMPONENT
    })
  })

  // When every child is the wrong component, prefer the mismatched-type
  // error over "requires at least one <Expected>" so authors swap the tag.
  it('reports wrong card type even when no correct children are present', async () => {
    const result = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Info" variant="Info" columns="Three">',
        '<TitleCard heading="B" buttonUrl="/b" buttonText="Open" buttonExternal={false}>',
        'Desc',
        '</TitleCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNSUPPORTED_COMPONENT
    })
    expect((result as MdxParserError).message).toMatch(
      /only accepts <InfoCard> children\. Found <TitleCard>/
    )
  })

  // getChildElements collects cards even when text siblings share the
  // paragraph; without a loose-text check that prose is lost on sync.
  it('rejects non-whitespace text siblings of card children', async () => {
    const result = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Info" variant="Info" columns="Three">',
        '<InfoCard heading="A">Body</InfoCard>Oops',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      component: 'CardGrid'
    })
    expect((result as MdxParserError).message).toMatch(/unexpected text "Oops"/)
  })

  it('rejects a NavigationCard with children', async () => {
    const result = await parseMdxToBlocks(
      [
        '<CardGrid ariaLabel="Nav" variant="Navigation" columns="One">',
        '<NavigationCard heading="Go" buttonUrl="/go" buttonText="Next">',
        'Unexpected content',
        '</NavigationCard>',
        '</CardGrid>'
      ].join('\n'),
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })
})
