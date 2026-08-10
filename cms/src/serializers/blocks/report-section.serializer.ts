import isHtml from 'is-html'
import { escDouble as esc, escMdxBraces } from '../shared'
import {
  SerializerFieldError,
  htmlToMarkdown,
  type FieldError
} from '../../utils'

interface ReportTextItem {
  textType?: string
  textContent?: string
  textDisclaimer?: string
}

/** The Strapi field a report-text item's content lives in, based on its type. */
function textField(
  textType: 'Paragraph' | 'Disclaimer'
): 'textContent' | 'textDisclaimer' {
  return textType === 'Paragraph' ? 'textContent' : 'textDisclaimer'
}

/**
 * Validate a single content block. Returns every failing field for this item
 * so an editor sees all of them at once, not just the first.
 */
function validateReportTextItem(
  item: ReportTextItem,
  index: number
): FieldError[] {
  const position = index + 1

  if (item.textType !== 'Paragraph' && item.textType !== 'Disclaimer') {
    return [
      {
        message: `Content Block ${position}: Block Type must be Paragraph or Disclaimer`,
        path: ['reportText', index, 'textType']
      }
    ]
  }

  const field = textField(item.textType)
  const value = item[field]
  if (!value || !value.trim()) {
    const label =
      field === 'textContent' ? 'Paragraph Content' : 'Disclaimer Text'
    return [
      {
        message: `Content Block ${position}: ${label} is required`,
        path: ['reportText', index, field]
      }
    ]
  }

  return []
}

/**
 * Validate the whole block. Returns every failing field across the block and
 * all of its content blocks, so an editor can fix everything in one pass.
 */
function validateReportSection(block: {
  heading?: string
  reportText?: ReportTextItem[]
}): FieldError[] {
  const fieldErrors: FieldError[] = []

  if (!block.heading || !block.heading.trim()) {
    fieldErrors.push({
      message: 'Report Section requires a Section Heading',
      path: ['heading']
    })
  }

  // Strapi's `required`/`min` constraints aren't enforced at save time
  if (!Array.isArray(block.reportText) || block.reportText.length === 0) {
    fieldErrors.push({
      message: 'Report Section requires at least one content block',
      path: ['reportText']
    })
    return fieldErrors
  }

  return [...fieldErrors, ...block.reportText.flatMap(validateReportTextItem)]
}

export function serialize(block: {
  heading?: string
  reportText?: ReportTextItem[]
}): string {
  const fieldErrors = validateReportSection(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  // Validation above guarantees heading and reportText items are present from here on.
  const items = block.reportText!.map((item) => {
    const textType = item.textType as 'Paragraph' | 'Disclaimer'
    const raw = item[textField(textType)]!

    // Content is a CKEditor field: usually already markdown, but convert
    // defensively if Strapi hands back HTML (matches blocks.faq's answer).
    const text = escMdxBraces(isHtml(raw) ? htmlToMarkdown(raw) : raw)

    // Blank lines around the text, and the closing tag at column 0 — see
    // blocks.faq's serializer for why: content ending in a list needs both,
    // or MDX swallows the closing tag into the list.
    return `<ReportText type="${textType}">\n\n${text}\n\n</ReportText>`
  })

  return `<ReportSection heading="${esc(block.heading!.trim())}">\n\n${items.join('\n\n')}\n\n</ReportSection>`
}
