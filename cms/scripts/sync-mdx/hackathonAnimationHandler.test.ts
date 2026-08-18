import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers HackathonAnimation handler
import './hackathonAnimationHandler'

const ctx: ParserContext = { locale: 'en' }

describe('HackathonAnimation handler', () => {
  it('parses the self-closing tag into a fieldless block', async () => {
    const blocks = await parseMdxToBlocks('<HackathonAnimation />', ctx)

    expect(blocks).toEqual([{ __component: 'blocks.hackathon-animation' }])
  })

  it('returns UNEXPECTED_PROP when given an attribute', async () => {
    const result = await parseMdxToBlocks(
      '<HackathonAnimation foo="bar" />',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNEXPECTED_PROP,
      prop: 'foo'
    })
  })

  it('returns UNEXPECTED_PROP for a spread attribute', async () => {
    const result = await parseMdxToBlocks(
      '<HackathonAnimation {...props} />',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNEXPECTED_PROP })
  })

  it('returns UNEXPECTED_CHILDREN when not self-closing', async () => {
    const result = await parseMdxToBlocks(
      '<HackathonAnimation>Oops</HackathonAnimation>',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNEXPECTED_CHILDREN
    })
  })
})
