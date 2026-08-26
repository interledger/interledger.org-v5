import { describe, it, expect } from 'vitest'
import { serialize } from './code-block.serializer'

describe('code-block serializer', () => {
  it('wraps code in a CodeBlock tag with language and code props', () => {
    const result = serialize({ code: 'const x = 1', language: 'javascript' })

    expect(result).toContain('<CodeBlock')
    expect(result).toContain('language="javascript"')
    expect(result).toContain('const x = 1')
  })

  it('includes title attribute when provided', () => {
    const result = serialize({
      code: 'const x = 1',
      language: 'typescript',
      title: 'Example'
    })

    expect(result).toContain('title="Example"')
  })

  it('omits title attribute when not provided', () => {
    const result = serialize({ code: 'const x = 1', language: 'javascript' })

    expect(result).not.toContain('title=')
  })

  it('escapes backticks in code', () => {
    const result = serialize({
      code: 'const x = `hello`',
      language: 'javascript'
    })

    expect(result).toContain('\\`hello\\`')
  })

  it('escapes template literal expressions in code', () => {
    const result = serialize({
      code: 'const x = `hello ${name}`',
      language: 'javascript'
    })

    expect(result).toContain('\\${name}')
  })

  it('escapes backslashes in code', () => {
    const result = serialize({
      code: 'const path = "C:\\\\Users"',
      language: 'javascript'
    })

    expect(result).toContain('C:\\\\\\\\Users')
  })

  it('throws when code is missing', () => {
    expect(() => serialize({ code: '', language: 'javascript' })).toThrow(
      'CodeBlock block is missing code'
    )
  })

  it('throws when language is missing', () => {
    expect(() => serialize({ code: 'x = 1', language: '' })).toThrow(
      'CodeBlock block is missing language'
    )
  })

  it('serialises Python code correctly', () => {
    const result = serialize({
      code: 'def hello():\n    print("world")',
      language: 'python',
      title: 'hello.py'
    })

    expect(result).toContain('language="python"')
    expect(result).toContain('title="hello.py"')
    expect(result).toContain('def hello()')
  })

  it('pads continuation lines by 2 spaces to offset the MDX attribute-template-literal indentation strip', () => {
    // MDX strips a fixed 2 columns of leading whitespace from every
    // continuation line of a `code={`...`}` JSX attribute template literal.
    // The serializer must compensate so the rendered code keeps its original
    // indentation; the first line is untouched since it isn't a continuation
    // line (it shares a physical line with the opening backtick).
    const result = serialize({
      code: 'def hello():\n    print("world")\n\n    return 1',
      language: 'python'
    })

    expect(result).toContain(
      'def hello():\n      print("world")\n\n      return 1'
    )
  })

  it('does not pad blank continuation lines', () => {
    const result = serialize({
      code: 'const x = 1\n\nconst y = 2',
      language: 'javascript'
    })

    expect(result).toContain('const x = 1\n\n  const y = 2')
  })
})
