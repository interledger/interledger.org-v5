import { describe, it, expect } from 'vitest'
import {
  ckeditorFieldToMarkdown,
  collapseNonTableLineBreaks,
  formatBlockquote,
  formatMdx,
  htmlFieldToMarkdown,
  looksLikeHtmlField,
  pathSlugToMdxFilename,
  resolveFilenameSlug
} from './mdx'

describe('looksLikeHtmlField', () => {
  it('is false for markdown that only carries an intentional <br/>', () => {
    // Regression: this string is a valid GFM table whose only HTML is one
    // intentional <br/> (e.g. a table-cell line break from
    // cms/src/admin/app.tsx). A plain isHtml() check would see that <br/>,
    // conclude the whole string is HTML, and send it through htmlToMarkdown
    // — which parses it as HTML and treats the `| a | b |` pipes as literal
    // text instead of a table, corrupting it.
    expect(
      looksLikeHtmlField('| a<br/>b | c |\n| --- | --- |\n| d | e |')
    ).toBe(false)
  })

  it('is true for a genuine HTML blob that also contains other tags', () => {
    expect(looksLikeHtmlField('<p>hello<br/>world</p>')).toBe(true)
  })

  it('is true for plain prose with a bare <br/> and no table', () => {
    expect(
      looksLikeHtmlField(
        "During a hackathon, you'll take on a real<br />financial challenge."
      )
    ).toBe(true)
  })
})

describe('htmlFieldToMarkdown', () => {
  it('leaves a table with an intentional <br/> untouched (no trim)', () => {
    const markdown = ' | a<br/>b | c |\n| --- | --- |\n| d | e | '
    expect(htmlFieldToMarkdown(markdown)).toBe(markdown)
  })

  it('still converts a genuine HTML field', () => {
    expect(htmlFieldToMarkdown('<p>hello<br/>world</p>')).toBe('hello  \nworld')
  })

  it('converts a bare <br/> in plain prose (no table) to a hard break', () => {
    expect(
      htmlFieldToMarkdown(
        "During a hackathon, you'll take on a real<br />financial challenge."
      )
    ).toBe("During a hackathon, you'll take on a real  \nfinancial challenge.")
  })
})

describe('ckeditorFieldToMarkdown', () => {
  it('leaves a table with an intentional <br/> untouched', () => {
    const markdown = '| a<br/>b | c |\n| --- | --- |\n| d | e |'
    expect(ckeditorFieldToMarkdown(markdown)).toBe(markdown)
  })

  it('still converts a genuine HTML field', () => {
    expect(ckeditorFieldToMarkdown('<p>hello<br/>world</p>')).toBe(
      'hello  \nworld'
    )
  })

  it('converts a bare <br/> in plain prose (no table) to a hard break', () => {
    expect(
      ckeditorFieldToMarkdown(
        "During a hackathon, you'll take on a real<br />financial challenge."
      )
    ).toBe("During a hackathon, you'll take on a real  \nfinancial challenge.")
  })
})

describe('collapseNonTableLineBreaks', () => {
  it('collapses a bare <br/> outside a table into a single space', () => {
    expect(collapseNonTableLineBreaks('real<br />financial challenge')).toBe(
      'real financial challenge'
    )
  })

  it('does not leave a double space when <br/> already has surrounding space', () => {
    expect(collapseNonTableLineBreaks('real <br/> financial challenge')).toBe(
      'real financial challenge'
    )
  })

  it('leaves a table-cell <br/> untouched', () => {
    const markdown = '| a<br/>b | c |\n| --- | --- |\n| d | e |'
    expect(collapseNonTableLineBreaks(markdown)).toBe(markdown)
  })
})

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
