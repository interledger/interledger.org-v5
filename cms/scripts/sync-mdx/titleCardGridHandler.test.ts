import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers TitleCardGrid handler
import './titleCardGridHandler'

const ctx: ParserContext = { locale: 'en' }

const open = (attrs: string) => `<TitleCardGrid ${attrs}>`

const card = (attrs: string, description = 'Card description.') =>
  [`<TitleCard ${attrs}>`, description, '</TitleCard>'].join('\n')

describe('TitleCardGrid handler', () => {
  it('parses a grid with a single card into blocks.card-grid', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Two"'),
      card(
        'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more" buttonExternal={false}',
        'Grant description.'
      ),
      '</TitleCardGrid>'
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

  it('includes subHeading when the subheading attribute is present', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="Grant heading" subheading="A subheading" buttonUrl="/grants/apply" buttonText="Learn more"'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      titleCards: [expect.objectContaining({ subHeading: 'A subheading' })]
    })
  })

  it('omits subHeading when the subheading attribute is absent', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const [titleCard] = (
      blocks[0] as { titleCards: Array<Record<string, unknown>> }
    ).titleCards

    expect(titleCard).not.toHaveProperty('subHeading')
  })

  it('sets secondaryCta.external to true when buttonExternal is true', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="Grant heading" buttonUrl="https://example.com" buttonText="Learn more" buttonExternal={true}'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      titleCards: [
        expect.objectContaining({
          secondaryCta: {
            link: 'https://example.com',
            text: 'Learn more',
            external: true,
            document: false
          }
        })
      ]
    })
  })

  it('defaults secondaryCta.external to false when buttonExternal is omitted', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      titleCards: [
        expect.objectContaining({
          secondaryCta: expect.objectContaining({ external: false })
        })
      ]
    })
  })

  it('parses multiple TitleCard children in order', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="First" buttonUrl="/one" buttonText="One"',
        'First description.'
      ),
      card(
        'heading="Second" buttonUrl="/two" buttonText="Two"',
        'Second description.'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      titleCards: [
        expect.objectContaining({ heading: 'First' }),
        expect.objectContaining({ heading: 'Second' })
      ]
    })
  })

  it('returns INVALID_PROP_VALUE for bad columns', async () => {
    const result = await parseMdxToBlocks(
      [
        open('ariaLabel="Grant options" columns="Four"'),
        card(
          'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"'
        ),
        '</TitleCardGrid>'
      ].join('\n'),
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns an error when TitleCard children are missing', async () => {
    const result = await parseMdxToBlocks(
      open('ariaLabel="Grant options" columns="Two"') + '</TitleCardGrid>',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
  })

  it('returns an error when a TitleCard has empty description', async () => {
    const result = await parseMdxToBlocks(
      [
        open('ariaLabel="Grant options" columns="Two"'),
        '<TitleCard heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"></TitleCard>',
        '</TitleCardGrid>'
      ].join('\n'),
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns MISSING_REQUIRED_PROP when ariaLabel is absent', async () => {
    const result = await parseMdxToBlocks(
      [
        open('columns="Two"'),
        card(
          'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"'
        ),
        '</TitleCardGrid>'
      ].join('\n'),
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })
})
