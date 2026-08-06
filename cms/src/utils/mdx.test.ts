import { describe, it, expect } from 'vitest'
import {
  formatBlockquote,
  formatMdx,
  pathSlugToMdxFilename,
  resolveFilenameSlug
} from './mdx'

describe('formatBlockquote', () => {
  it('returns plain text without wrapping curly quotes', () => {
    expect(formatBlockquote('Money should move like data.')).toBe(
      'Money should move like data.'
    )
  })

  it('strips surrounding straight and curly quotes', () => {
    expect(formatBlockquote('"quoted"')).toBe('quoted')
    expect(formatBlockquote('“curly”')).toBe('curly')
    expect(formatBlockquote('‘single’')).toBe('single')
  })

  it('trims whitespace', () => {
    expect(formatBlockquote('  spaced  ')).toBe('spaced')
  })
})

describe('resolveFilenameSlug', () => {
  it('uses the English slug for a non-English locale when provided', () => {
    expect(
      resolveFilenameSlug('es', 'subvenciones/beca', 'grant/fellowship')
    ).toBe('grant/fellowship')
  })

  it('falls back to its own slug for a non-English locale with no English sibling', () => {
    expect(resolveFilenameSlug('es', 'subvenciones/beca', undefined)).toBe(
      'subvenciones/beca'
    )
  })

  it('always uses its own slug for the English locale, ignoring englishSlug', () => {
    expect(
      resolveFilenameSlug('en', 'grant/fellowship', 'grant/fellowship')
    ).toBe('grant/fellowship')
  })
})

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
