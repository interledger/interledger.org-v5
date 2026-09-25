import { describe, it, expect } from 'vitest'
import {
  ckeditorFieldToCompiledMarkdown,
  ckeditorFieldToParsedMarkdown,
  formatBlockquote,
  formatMdx,
  looksLikeHtmlField
} from './mdx'
import { serialize as serializeCtaStrip } from '../serializers/blocks/cta-strip.serializer'
import { serialize as serializeQuote } from '../serializers/blocks/quote.serializer'
import { serialize as serializeCalloutText } from '../serializers/blocks/callout-text.serializer'
import { serialize as serializeSplitLayout } from '../serializers/blocks/split-layout.serializer'
import { serialize as serializeBlockquote } from '../serializers/blocks/blockquote.serializer'

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
})

describe('ckeditorFieldToCompiledMarkdown', () => {
  it('leaves a table with an intentional <br/> untouched, trimmed', () => {
    const markdown = ' | a<br/>b | c |\n| --- | --- |\n| d | e | '
    expect(ckeditorFieldToCompiledMarkdown(markdown)).toBe(
      '| a<br/>b | c |\n| --- | --- |\n| d | e |'
    )
  })

  it('still converts a genuine HTML field', () => {
    expect(ckeditorFieldToCompiledMarkdown('<p>hello<br/>world</p>')).toBe(
      'hello  \nworld'
    )
  })
})

describe('ckeditorFieldToParsedMarkdown', () => {
  it('promotes a stray <br/> to a paragraph break', () => {
    expect(ckeditorFieldToParsedMarkdown('line one<br/>line two')).toBe(
      'line one\n\nline two'
    )
  })

  it('promotes a <br/> inside a table row too — table line breaks are not supported here', () => {
    const markdown = '| a<br/>b | c |\n| --- | --- |\n| d | e |'
    expect(ckeditorFieldToParsedMarkdown(markdown)).toBe(
      '| a\n\nb | c |\n| --- | --- |\n| d | e |'
    )
  })

  it('still converts a genuine HTML field, with no literal <br/> left to promote', () => {
    expect(ckeditorFieldToParsedMarkdown('<p>hello<br/>world</p>')).toBe(
      'hello  \nworld'
    )
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

  it('does not wrap a CtaStrip description (INTORG-1188)', async () => {
    // Regression: Prettier's MDX printer wraps JSX children text at
    // printWidth and ignores proseWrap entirely when that text sits flush
    // against the tags. cta-strip.serializer.ts separates the description
    // from <CtaStrip> with a blank line so Prettier treats it as a real
    // paragraph instead, where proseWrap is honored.
    const description =
      'Interledger brings together people across technology, policy, ' +
      'research, education, and advocacy to make financial systems open, ' +
      'connected, and accessible to all.'
    const ctaStrip = serializeCtaStrip({
      heading: 'The People Behind the Work',
      primaryButtonText: 'Meet the Team',
      primaryButtonLink: '/team',
      description
    })
    const content = ['---', "title: 'test'", '---', '', ctaStrip, ''].join('\n')

    const result = await formatMdx(content)

    expect(result).toContain(description)
  })

  it('does not wrap prose for any tag-adjacent JSX-children serializer (INTORG-1188)', async () => {
    // Regression (INTORG-1188): Prettier wraps JSX children text flush
    // against tags regardless of proseWrap. Checked per serializer, not
    // just once, since each has a different shape and could regress independently.
    const prose =
      'Interledger brings together people across technology, policy, ' +
      'research, education, and advocacy to make financial systems open, ' +
      'connected, and accessible to all.'

    const cases: Array<[string, () => string]> = [
      [
        'CtaStrip',
        () =>
          serializeCtaStrip({
            heading: 'The People Behind the Work',
            primaryButtonText: 'Meet the Team',
            primaryButtonLink: '/team',
            description: prose
          })
      ],
      ['Quote', () => serializeQuote({ quote: prose })],
      ['CalloutText', () => serializeCalloutText({ content: prose })],
      [
        'SplitLayout',
        () =>
          serializeSplitLayout({
            media: { image: { url: '/uploads/education_grant.jpg' } },
            content: prose
          })
      ],
      ['Blockquote', () => serializeBlockquote({ quote: prose })]
    ]

    for (const [name, serialize] of cases) {
      const content = ['---', "title: 'test'", '---', '', serialize(), ''].join(
        '\n'
      )

      const result = await formatMdx(content)

      expect(result, `${name} wrapped its prose`).toContain(prose)
    }
  })
})
