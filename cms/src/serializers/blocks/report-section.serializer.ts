import { escDouble as esc, escMdxBraces } from '../shared'
import {
  SerializerFieldError,
  ckeditorFieldToCompiledMarkdown,
  isReportTextType,
  REPORT_TEXT_TYPES,
  type FieldError,
  type ReportTextType
} from '../../utils'

interface ReportTextItem {
  textType?: string
  textContent?: string
  textDisclaimer?: string
}

/** Paragraph and References items store their text in `textContent`; Disclaimer uses `textDisclaimer`. */
function textField(textType: ReportTextType): 'textContent' | 'textDisclaimer' {
  return textType === 'Disclaimer' ? 'textDisclaimer' : 'textContent'
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

  if (!item.textType || !isReportTextType(item.textType)) {
    return [
      {
        message: `Content Block ${position}: Block Type must be one of ${REPORT_TEXT_TYPES.join(', ')}`,
        path: ['reportText', index, 'textType']
      }
    ]
  }

  const field = textField(item.textType)
  const value = item[field]
  if (!value || !value.trim()) {
    const label =
      item.textType === 'Disclaimer'
        ? 'Disclaimer Text'
        : item.textType === 'References'
          ? 'References Content'
          : 'Paragraph Content'
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
    const textType = item.textType as ReportTextType
    const raw = item[textField(textType)]!

    const text = escMdxBraces(ckeditorFieldToCompiledMarkdown(raw))

    return `<ReportText type="${textType}">\n\n${text}\n\n</ReportText>`
  })

  const heading = esc(block.heading!.trim())

  return `<ReportSection>\n\n## ${heading}\n\n${items.join('\n\n')}\n\n</ReportSection>`
}
