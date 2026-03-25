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

  it('merges consecutive markdown nodes into a single paragraph block', async () => {
    const blocks = await parseMdxToBlocks('## Hello\n\nSome text here.', ctx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: '## Hello\n\nSome text here.'
    })
  })

  it('merges thematic breaks with surrounding markdown', async () => {
    const blocks = await parseMdxToBlocks('Hello\n\n---\n\nWorld', ctx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].__component).toBe('blocks.paragraph')
  })
})

// ---------------------------------------------------------------------------
// Paragraph merging
// ---------------------------------------------------------------------------

describe('paragraph merging', () => {
  const ctx = { locale: 'en' }

  it('splits on JSX component: markdown before and after', async () => {
    const mdx = [
      'Intro paragraph.',
      '',
      '<Paragraph>Rich content.</Paragraph>',
      '',
      'Outro paragraph.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Intro paragraph.'
    })
    expect(blocks[1]).toMatchObject({ __component: 'blocks.paragraph' })
    expect((blocks[1] as { content: string }).content).toBe('Rich content.')
    expect(blocks[2]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Outro paragraph.'
    })
  })

  it('merges heading + paragraph + list into one block', async () => {
    const mdx = [
      '## Section title',
      '',
      'A paragraph of text.',
      '',
      '- item one',
      '- item two'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].__component).toBe('blocks.paragraph')
    const content = (blocks[0] as { content: string }).content
    expect(content).toContain('## Section title')
    expect(content).toContain('A paragraph of text.')
    expect(content).toContain('- item one')
  })

  it('handles markdown only at the end (trailing flush)', async () => {
    const mdx = [
      '<Paragraph>First block.</Paragraph>',
      '',
      'Trailing markdown.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Trailing markdown.'
    })
  })

  it('handles markdown only at the start (flush before JSX)', async () => {
    const mdx = [
      'Leading markdown.',
      '',
      '<Paragraph>Second block.</Paragraph>'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      __component: 'blocks.paragraph',
      content: 'Leading markdown.'
    })
  })

  it('produces one block for a long post with no JSX', async () => {
    const mdx = [
      '# Title',
      '',
      'Paragraph one.',
      '',
      'Paragraph two.',
      '',
      '## Subtitle',
      '',
      '- list item',
      '',
      'Final paragraph.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].__component).toBe('blocks.paragraph')
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
