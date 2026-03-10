import { describe, it, expect } from 'vitest'
import './paragraphHandler'
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

  // --- Markdown node fallback ---

  it('converts markdown nodes to paragraph blocks', async () => {
    const blocks = await parseMdxToBlocks('## Hello\n\nSome text here.', ctx)

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: '## Hello'
    })
    expect(blocks[1]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Some text here.'
    })
  })

  it('skips whitespace-only markdown nodes', async () => {
    // A thematic break (---) produces a node with no textual content,
    // but it still has non-whitespace source so it should be kept
    const blocks = await parseMdxToBlocks('Hello\n\n---\n\nWorld', ctx)

    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks.every((b) => b.__component === 'blocks.paragraph')).toBe(true)
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
