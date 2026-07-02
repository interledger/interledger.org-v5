import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers CodeBlock handler
import './codeBlockHandler'

const ctx = { locale: 'en' }

describe('CodeBlock handler', () => {
  it('parses language, title, and template literal code', async () => {
    const blocks = await parseMdxToBlocks(
      '<CodeBlock language="html" title="test" code={`qwe`} />',
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.code-block',
        code: 'qwe',
        language: 'html',
        title: 'test'
      }
    ])
  })

  it('parses multiline code from a template literal', async () => {
    const blocks = await parseMdxToBlocks(
      `<CodeBlock language="python" title="hello.py" code={\`def hello():
    print("world")\`} />`,
      ctx
    )

    expect(blocks[0]).toMatchObject({
      __component: 'blocks.code-block',
      language: 'python',
      title: 'hello.py',
      code: 'def hello():\n    print("world")'
    })
  })

  it('preserves source indentation as-is', async () => {
    const blocks = await parseMdxToBlocks(
      `<CodeBlock language="javascript" code={\`function run() {
    if (true) {
        return 1
    }
}\`} />`,
      ctx
    )

    expect((blocks[0] as { code: string }).code).toBe(
      'function run() {\n    if (true) {\n        return 1\n    }\n}'
    )
  })

  it('omits title when not provided', async () => {
    const blocks = await parseMdxToBlocks(
      '<CodeBlock language="javascript" code={`const x = 1`} />',
      ctx
    )

    expect(blocks[0]).toEqual({
      __component: 'blocks.code-block',
      code: 'const x = 1',
      language: 'javascript'
    })
  })

  it('preserves markdown order around CodeBlock', async () => {
    const blocks = await parseMdxToBlocks(
      `Intro paragraph.

<CodeBlock language="bash" code={\`echo hi\`} />

Outro paragraph.`,
      ctx
    )

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.code-block',
      code: 'echo hi',
      language: 'bash'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})

describe('CodeBlock handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when language is missing', async () => {
    const result = await parseMdxToBlocks(
      '<CodeBlock code={`const x = 1`} />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when code is missing', async () => {
    const result = await parseMdxToBlocks(
      '<CodeBlock language="javascript" />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns INVALID_PROP_VALUE for unsupported language', async () => {
    const result = await parseMdxToBlocks(
      '<CodeBlock language="cobol" code={`x`} />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE
    })
  })

  it('returns DYNAMIC_EXPRESSION for template interpolation', async () => {
    const result = await parseMdxToBlocks(
      '<CodeBlock language="javascript" code={`hello ${name}`} />',
      ctx
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.DYNAMIC_EXPRESSION
    })
  })
})
