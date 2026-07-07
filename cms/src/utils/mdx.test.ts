import { describe, it, expect } from 'vitest'
import { formatMdx, pathSlugToMdxFilename } from './mdx'

describe('pathSlugToMdxFilename', () => {
  it('flattens nested path slugs to hyphenated filename stems', () => {
    expect(pathSlugToMdxFilename('grant/fellowship/jane-doe')).toBe(
      'grant-fellowship-jane-doe'
    )
    expect(pathSlugToMdxFilename('/summit/2025/speakers/jane-doe/')).toBe(
      'summit-2025-speakers-jane-doe'
    )
  })
})

describe('formatMdx', () => {
  it('preserves indentation inside a CodeBlock code attribute', async () => {
    const content = [
      '---',
      "title: 'test'",
      '---',
      '',
      '<CodeBlock language="javascript" code={`function fetchTags() {',
      '  if (true) {',
      '    return []',
      '  }',
      '}',
      '`} />',
      ''
    ].join('\n')

    const result = await formatMdx(content)

    expect(result).toContain('  if (true) {')
    expect(result).toContain('    return []')
  })

  it('preserves blank lines inside a CodeBlock code attribute', async () => {
    const content = [
      '---',
      "title: 'test'",
      '---',
      '',
      '<CodeBlock language="javascript" code={`const a = 1',
      '',
      'const b = 2',
      '`} />',
      ''
    ].join('\n')

    const result = await formatMdx(content)

    expect(result).toContain('const a = 1\n\nconst b = 2')
  })

  it('still formats the surrounding MDX normally', async () => {
    const content = [
      '---',
      "title: 'test'",
      '---',
      '',
      '<CodeBlock language="javascript" code={`const a = 1',
      '`} />',
      '',
      '<Paragraph>',
      '',
      'Hello world.',
      '',
      '</Paragraph>',
      ''
    ].join('\n')

    const result = await formatMdx(content)

    expect(result).toContain('Hello world.')
  })
})
