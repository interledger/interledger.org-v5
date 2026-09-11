import { convert } from 'html-to-text'
import MarkdownIt from 'markdown-it'

const CONVERT_OPTIONS = {
  wordwrap: null,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', format: 'skip' },
    { selector: 'figure', format: 'skip' }
  ]
}

function excerptFromMarkdown(parser: MarkdownIt, body: unknown): string {
  const safeBody = typeof body === 'string' ? body : ''
  const html = parser.render(safeBody)
  const text = convert(html, CONVERT_OPTIONS)
  return convert(text, CONVERT_OPTIONS)
}

const excerptParser = new MarkdownIt()
const searchPlainParser = new MarkdownIt().disable([
  'heading',
  'lheading',
  'blockquote'
])

export const createExcerpt = (body: unknown): string =>
  excerptFromMarkdown(excerptParser, body)

/** Inline markdown stripped; ATX/setext/blockquote punctuation kept for search. */
export const createSearchPlainText = (body: unknown): string =>
  excerptFromMarkdown(searchPlainParser, body)
