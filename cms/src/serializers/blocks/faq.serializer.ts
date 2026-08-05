import isHtml from 'is-html'
import { escDouble as esc, escMdxBraces } from '../shared'
import {
  SerializerFieldError,
  htmlToMarkdown,
  type FieldError
} from '../../utils'

interface FaqItem {
  question?: string
  answer?: string
}

/**
 * Validate a single question. Returns every failing field for this item so an
 * editor sees all of them at once, not just the first.
 */
function validateFaqItem(item: FaqItem, index: number): FieldError[] {
  const position = index + 1
  const fieldErrors: FieldError[] = []

  if (!item.question || !item.question.trim())
    fieldErrors.push({
      message: `Question ${position} is missing its question text`,
      path: ['items', index, 'question']
    })
  if (!item.answer || !item.answer.trim())
    fieldErrors.push({
      message: `Question ${position} is missing an answer`,
      path: ['items', index, 'answer']
    })

  return fieldErrors
}

/**
 * Validate the whole block. Returns every failing field across the block and
 * all of its questions, so an editor can fix everything in one pass.
 * `heading` is optional and is deliberately not checked.
 */
function validateFaq(block: {
  heading?: string
  items?: FaqItem[]
}): FieldError[] {
  // Strapi's `required`/`min` constraints aren't enforced at save time
  if (!Array.isArray(block.items) || block.items.length === 0) {
    return [
      {
        message: 'FAQ block requires at least one question',
        path: ['items']
      }
    ]
  }

  return block.items.flatMap(validateFaqItem)
}

export function serialize(block: {
  heading?: string
  items?: FaqItem[]
}): string {
  const fieldErrors = validateFaq(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  // Validation above guarantees items and their fields are present from here on.
  const headingAttr = block.heading?.trim()
    ? ` heading="${esc(block.heading.trim())}"`
    : ''

  const items = block.items.map((item) => {
    // `answer` is a CKEditor field: usually already markdown, but convert
    // defensively if Strapi hands back HTML (matches callout-text).
    const answer = escMdxBraces(
      isHtml(item.answer) ? htmlToMarkdown(item.answer) : item.answer
    )

    // Blank lines around the answer, and the closing tag at column 0. An
    // answer ending in a list needs both: MDX reads an indented line after a
    // list item as a continuation of that item, so `\n  </FaqItem>` gets
    // swallowed into the list and the page fails to build with "Expected the
    // closing tag </FaqItem> ... after the end of listItem". The blank line
    // terminates the list. Matches blocks.paragraph's shape.
    return `<FaqItem question="${esc(item.question.trim())}">\n\n${answer}\n\n</FaqItem>`
  })

  return `<Faq${headingAttr}>\n\n${items.join('\n\n')}\n\n</Faq>`
}
