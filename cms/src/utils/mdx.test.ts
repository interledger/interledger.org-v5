import { describe, it, expect } from 'vitest'
import {
  ckeditorBreaksToNewlines,
  ckeditorFieldToMarkdown,
  formatBlockquote,
  formatMdx,
  htmlFieldToMarkdown,
  looksLikeHtmlField,
  pathSlugToMdxFilename,
  sectionScopedMdxFilename,
  resolveFilenameSlug
} from './mdx'

describe('looksLikeHtmlField', () => {
  it('is false for markdown that only carries an intentional <br/> in a table', () => {
    // Table-cell <br/> is intentional (app.tsx) — must not trip isHtml and
    // get corrupted by htmlToMarkdown's HTML parsing.
    expect(
      looksLikeHtmlField('| a<br/>b | c |\n| --- | --- |\n| d | e |')
    ).toBe(false)
  })

  it('is true for a genuine HTML blob that also contains other tags', () => {
    expect(looksLikeHtmlField('<p>hello<br/>world</p>')).toBe(true)
  })

  it('is false for plain prose with a bare <br/> and no table', () => {
    // A <br/> outside a table is intentional too (Shift+Enter) — not
    // evidence the field is HTML.
    expect(
      looksLikeHtmlField(
        "During a hackathon, you'll take on a real<br />financial challenge."
      )
    ).toBe(false)
  })

  it('is false for a malformed <br/ > tag that a stricter mask would miss', () => {
    // is-html's own pattern (`<tag\b[^>]*>`) matches this malformed tag, so
    // the mask must too, or it still misclassifies.
    expect(looksLikeHtmlField('real<br/ >break')).toBe(false)
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

  it('leaves a bare <br/> in plain prose (no table) unchanged', () => {
    const markdown =
      "During a hackathon, you'll take on a real<br />financial challenge."
    expect(htmlFieldToMarkdown(markdown)).toBe(markdown)
  })

  it('does not corrupt already-valid markdown that also contains a <br/>', () => {
    const input =
      '**Bold** intro with a real<br />break\n\n- item one\n- item two\n\nSee [docs](https://x.com/a_b).'
    expect(htmlFieldToMarkdown(input)).toBe(input)
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

  it('leaves a bare <br/> in plain prose (no table) unchanged', () => {
    const markdown =
      "During a hackathon, you'll take on a real<br />financial challenge."
    expect(ckeditorFieldToMarkdown(markdown)).toBe(markdown)
  })

  it('does not corrupt already-valid markdown that also contains a <br/>', () => {
    const input =
      '**Bold** intro with a real<br />break\n\n- item one\n- item two\n\nSee [docs](https://x.com/a_b).'
    expect(ckeditorFieldToMarkdown(input)).toBe(input.trim())
  })
})

describe('ckeditorBreaksToNewlines', () => {
  it('converts a single <br/> to \\n', () => {
    expect(ckeditorBreaksToNewlines('real<br />break')).toBe('real\nbreak')
  })

  it('converts a double <br/><br/> (real Enter) to \\n\\n, not two single replacements', () => {
    expect(ckeditorBreaksToNewlines('para one<br /><br />para two')).toBe(
      'para one\n\npara two'
    )
  })

  it('handles a double break with whitespace between the tags', () => {
    expect(ckeditorBreaksToNewlines('para one<br/> <br/>para two')).toBe(
      'para one\n\npara two'
    )
  })

  it('is idempotent on already-\\n content', () => {
    const value = 'soft\nbreak\n\nnew paragraph'
    expect(ckeditorBreaksToNewlines(value)).toBe(value)
  })

  it('leaves content with no <br> untouched', () => {
    expect(ckeditorBreaksToNewlines('plain text')).toBe('plain text')
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

describe('sectionScopedMdxFilename', () => {
  // The bug in INTORG-1132: both FAQs are pathSlug 'faq', so the stem has to
  // carry the section or the hackathon export overwrites faq.mdx.
  it('gives the two FAQs different filenames', () => {
    expect(sectionScopedMdxFilename('faq', 'foundation')).toBe('faq')
    expect(sectionScopedMdxFilename('faq', 'hackathon')).toBe('hackathon-faq')
  })

  it('leaves foundation entries unprefixed, since they route from the root', () => {
    expect(
      sectionScopedMdxFilename('grant/grantmaking-faq', 'foundation')
    ).toBe('grant-grantmaking-faq')
  })

  it('flattens a nested slug under its section prefix', () => {
    expect(sectionScopedMdxFilename('2025/speakers/jane-doe', 'summit')).toBe(
      'summit-2025-speakers-jane-doe'
    )
  })

  // Leading and trailing slashes must not produce a doubled separator.
  it('normalizes surrounding slashes before prefixing', () => {
    expect(sectionScopedMdxFilename('/faq/', 'hackathon')).toBe('hackathon-faq')
  })

  it('falls back to the bare stem when there is no section', () => {
    expect(sectionScopedMdxFilename('faq')).toBe('faq')
    expect(sectionScopedMdxFilename('faq', null)).toBe('faq')
    expect(sectionScopedMdxFilename('faq', '')).toBe('faq')
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
