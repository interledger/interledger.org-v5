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
  it('parses a grid with a single card', async () => {
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
        __component: 'blocks.title-card-grid',
        ariaLabel: 'Grant options',
        columns: 'Two',
        titleCards: [
          {
            heading: 'Grant heading',
            description: 'Grant description.',
            secondaryCta: {
              link: '/grants/apply',
              text: 'Learn more',
              external: false
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
            external: true
          }
        })
      ]
    })
  })

  it('sets secondaryCta.external to false when buttonExternal is absent', async () => {
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
          secondaryCta: {
            link: '/grants/apply',
            text: 'Learn more',
            external: false
          }
        })
      ]
    })
  })

  it('parses multiple cards in document order', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="First" buttonUrl="/grants/first" buttonText="Learn more"',
        'First description.'
      ),
      card(
        'heading="Second" buttonUrl="/grants/second" buttonText="Learn more"',
        'Second description.'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const titleCards = (blocks[0] as { titleCards: Array<{ heading: string }> })
      .titleCards

    expect(titleCards.map((c) => c.heading)).toEqual(['First', 'Second'])
  })

  it('parses a card written inline on a single line', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      '<TitleCard heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more">Grant description.</TitleCard>',
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.title-card-grid',
        ariaLabel: 'Grant options',
        columns: 'Three',
        titleCards: [
          {
            heading: 'Grant heading',
            description: 'Grant description.',
            secondaryCta: {
              link: '/grants/apply',
              text: 'Learn more',
              external: false
            }
          }
        ]
      }
    ])
  })

  it('preserves markdown in the description', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card(
        'heading="Grant heading" buttonUrl="/grants/apply" buttonText="Learn more"',
        'Visit [our site](https://interledger.org) for **more**.'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const [titleCard] = (
      blocks[0] as { titleCards: Array<{ description: string }> }
    ).titleCards

    expect(titleCard.description).toContain(
      '[our site](https://interledger.org)'
    )
    expect(titleCard.description).toContain('**more**')
  })

  it('returns MISSING_REQUIRED_PROP when ariaLabel is absent', async () => {
    const mdx = [
      open('columns="Three"'),
      card('heading="H" buttonUrl="/p" buttonText="T"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when columns is absent', async () => {
    const mdx = [
      open('ariaLabel="Grant options"'),
      card('heading="H" buttonUrl="/p" buttonText="T"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns INVALID_PROP_VALUE for an unsupported columns value', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Four"'),
      card('heading="H" buttonUrl="/p" buttonText="T"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns MISSING_REQUIRED_PROP when there are no TitleCard children', async () => {
    const mdx = `<TitleCardGrid ariaLabel="Grant options" columns="Three" />`

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when a card is missing heading', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card('buttonUrl="/p" buttonText="T"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when a card is missing buttonUrl', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card('heading="H" buttonText="T"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when a card is missing buttonText', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      card('heading="H" buttonUrl="/p"'),
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns INVALID_PROP_VALUE when a card has empty description children', async () => {
    const mdx = [
      open('ariaLabel="Grant options" columns="Three"'),
      '<TitleCard heading="H" buttonUrl="/p" buttonText="T" />',
      '</TitleCardGrid>'
    ].join('\n')

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })
})

describe('TitleCardGrid handler (locale context)', () => {
  it('produces identical output for en and es locales', async () => {
    const mdx = [
      open('ariaLabel="Opciones de subvención" columns="Two"'),
      card(
        'heading="Encabezado" buttonUrl="/grants/apply" buttonText="Más información"',
        'Descripción de la subvención.'
      ),
      '</TitleCardGrid>'
    ].join('\n')

    const enBlocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    const esBlocks = await parseMdxToBlocks(mdx, { locale: 'es' })

    expect(esBlocks).toEqual(enBlocks)
  })
})
