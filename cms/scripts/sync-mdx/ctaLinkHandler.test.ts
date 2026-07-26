import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers CtaLink handler
import './ctaLinkHandler'

const CTX: ParserContext = { locale: 'en' }

describe('CtaLink handler', () => {
  it('parses text and link', async () => {
    const blocks = await parseMdxToBlocks(
      '<CtaLink text="Apply now" link="https://example.com" />',
      CTX
    )

    expect(blocks).toEqual([
      {
        __component: 'shared.cta-link',
        text: 'Apply now',
        link: 'https://example.com'
      }
    ])
  })

  it('parses style and external', async () => {
    const blocks = await parseMdxToBlocks(
      '<CtaLink text="Apply now" link="https://example.com" style="secondary" external={true} />',
      CTX
    )

    expect(blocks).toEqual([
      {
        __component: 'shared.cta-link',
        text: 'Apply now',
        link: 'https://example.com',
        style: 'secondary',
        external: true
      }
    ])
  })

  it('rejects an invalid style value', async () => {
    const result = await parseMdxToBlocks(
      '<CtaLink text="Apply now" link="https://example.com" style="tertiary" />',
      CTX
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.INVALID_PROP_VALUE
    )
  })

  it('requires text', async () => {
    const result = await parseMdxToBlocks(
      '<CtaLink link="https://example.com" />',
      CTX
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('requires link', async () => {
    const result = await parseMdxToBlocks('<CtaLink text="Apply now" />', CTX)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })
})
