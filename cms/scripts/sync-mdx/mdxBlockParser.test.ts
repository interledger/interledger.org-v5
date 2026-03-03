import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, getRegisteredComponents } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// parseMdxToBlocks
// ---------------------------------------------------------------------------

describe('parseMdxToBlocks', () => {
  const ctx = { locale: 'en' }

  it('returns empty array for empty body', async () => {
    expect(await parseMdxToBlocks('', ctx)).toEqual([])
  })

  it('returns empty array for whitespace-only body', async () => {
    expect(await parseMdxToBlocks('   \n\n  ', ctx)).toEqual([])
  })

  it('throws MdxParserError for malformed MDX', async () => {
    // Unclosed JSX tag that remark-mdx cannot parse
    await expect(parseMdxToBlocks('<Broken attr={>', ctx)).rejects.toThrow(
      MdxParserError
    )

    await expect(
      parseMdxToBlocks('<Broken attr={>', ctx)
    ).rejects.toMatchObject({ code: ParserErrorCode.MDX_PARSE_ERROR })
  })

  it('throws UNSUPPORTED_COMPONENT for unregistered JSX', async () => {
    await expect(
      parseMdxToBlocks('<UnknownWidget foo="bar" />', ctx)
    ).rejects.toThrow(MdxParserError)

    await expect(
      parseMdxToBlocks('<UnknownWidget foo="bar" />', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.UNSUPPORTED_COMPONENT,
      component: 'UnknownWidget'
    })
  })

  it('throws DYNAMIC_EXPRESSION for bare top-level expressions', async () => {
    // {someVariable} becomes mdxFlowExpression in the AST
    await expect(parseMdxToBlocks('{someVariable}', ctx)).rejects.toThrow(
      MdxParserError
    )

    await expect(parseMdxToBlocks('{someVariable}', ctx)).rejects.toMatchObject(
      {
        code: ParserErrorCode.DYNAMIC_EXPRESSION
      }
    )
  })

  it('throws DYNAMIC_EXPRESSION for arrow function expressions', async () => {
    await expect(
      parseMdxToBlocks('{() => doSomething()}', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.DYNAMIC_EXPRESSION
    })
  })

  it('throws DYNAMIC_EXPRESSION for import statements', async () => {
    await expect(
      parseMdxToBlocks('import { foo } from "bar"', ctx)
    ).rejects.toThrow(MdxParserError)

    await expect(
      parseMdxToBlocks('import { foo } from "bar"', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.DYNAMIC_EXPRESSION
    })
  })

  it('throws DYNAMIC_EXPRESSION for export statements', async () => {
    await expect(
      parseMdxToBlocks('export const x = 1', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.DYNAMIC_EXPRESSION
    })
  })

  it('throws UNSUPPORTED_COMPONENT for JSX fragments', async () => {
    await expect(parseMdxToBlocks('<>\n  content\n</>', ctx)).rejects.toThrow(
      MdxParserError
    )

    await expect(
      parseMdxToBlocks('<>\n  content\n</>', ctx)
    ).rejects.toMatchObject({
      code: ParserErrorCode.UNSUPPORTED_COMPONENT
    })
  })
})

// ---------------------------------------------------------------------------
// getRegisteredComponents
// ---------------------------------------------------------------------------

describe('getRegisteredComponents', () => {
  it('returns an array', () => {
    const names = getRegisteredComponents()
    expect(Array.isArray(names)).toBe(true)
  })
})
