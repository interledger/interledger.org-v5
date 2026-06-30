import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/code-block.serializer'

// Side-effect import: registers CodeBlock handler
import './codeBlockHandler'

const ctx: ParserContext = { locale: 'en' }

async function roundTrip(code: string, language = 'javascript') {
  const mdx = serialize({ code, language })
  const blocks = await parseMdxToBlocks(mdx, ctx)
  if (blocks instanceof Error) throw blocks
  return (blocks[0] as { code: string }).code
}

describe('CodeBlock round-trip (serialize → parse)', () => {
  it('preserves plain code', async () => {
    const code = 'const x = 1'
    expect(await roundTrip(code)).toBe(code)
  })

  it('preserves literal template-literal interpolation', async () => {
    const code = 'const greeting = `hello ${name}`'
    expect(await roundTrip(code)).toBe(code)
  })

  it('preserves a bare ${...} sequence', async () => {
    const code = 'echo "${HOME}/bin"'
    expect(await roundTrip(code, 'bash')).toBe(code)
  })

  it('preserves backslashes', async () => {
    const code = 'const path = "C:\\Users\\dev"'
    expect(await roundTrip(code)).toBe(code)
  })

  it('preserves a backslash directly before an interpolation', async () => {
    const code = 'const s = "\\${not interpolated}"'
    expect(await roundTrip(code)).toBe(code)
  })
})
