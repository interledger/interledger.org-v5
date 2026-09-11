import { convert } from 'html-to-text'
import MarkdownIt from 'markdown-it'

const CONVERT_OPTIONS = {
  wordwrap: null as null,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', format: 'skip' },
    { selector: 'figure', format: 'skip' }
  ]
}

const headingSelectors = [1, 2, 3, 4, 5, 6].map((level) => ({
  selector: `h${level}`,
  format: 'heading',
  options: { uppercase: false, leadingLineBreaks: 1, trailingLineBreaks: 1 }
}))

const DISPLAY_CONVERT_OPTIONS = {
  wordwrap: null as null,
  selectors: [
    ...CONVERT_OPTIONS.selectors,
    ...headingSelectors,
    {
      selector: 'blockquote',
      format: 'block',
      options: { leadingLineBreaks: 1, trailingLineBreaks: 1 }
    }
  ]
}

function excerptFromMarkdown(
  parser: MarkdownIt,
  body: unknown,
  convertOptions:
    | typeof CONVERT_OPTIONS
    | typeof DISPLAY_CONVERT_OPTIONS = CONVERT_OPTIONS
): string {
  const safeBody = typeof body === 'string' ? body : ''
  const html = parser.render(safeBody)
  const text = convert(html, convertOptions)
  return convert(text, convertOptions)
}

const excerptParser = new MarkdownIt()
const searchPlainParser = new MarkdownIt().disable([
  'heading',
  'lheading',
  'blockquote'
])

export const createExcerpt = (body: unknown): string =>
  excerptFromMarkdown(excerptParser, body)

/** Markdown as readable prose: no ATX/setext/blockquote punctuation, no shouted headings. */
export const createDisplayPlainText = (body: unknown): string =>
  excerptFromMarkdown(excerptParser, body, DISPLAY_CONVERT_OPTIONS)

/** Inline markdown stripped; ATX/setext/blockquote punctuation kept for search. */
export const createSearchPlainText = (body: unknown): string =>
  excerptFromMarkdown(searchPlainParser, body)
