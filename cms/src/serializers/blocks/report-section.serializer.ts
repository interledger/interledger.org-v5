import { escDouble as esc, escMdxBraces } from '../shared'
import {
  SerializerFieldError,
  ckeditorFieldToCompiledMarkdown,
  isReportTextType,
  isCtaButtonStyle,
  hasConflictingCtaFlags,
  REPORT_TEXT_TYPES,
  type FieldError,
  type ReportTextType,
  type CtaButtonEntry
} from '../../utils'

interface ReportTextItem {
  textType?: string
  textContent?: string
  textDisclaimer?: string
  buttonCta?: CtaButtonEntry
}

/** Paragraph and References items store their text in `textContent`; Disclaimer uses `textDisclaimer`. */
function textField(textType: ReportTextType): 'textContent' | 'textDisclaimer' {
  return textType === 'Disclaimer' ? 'textDisclaimer' : 'textContent'
}

/**
 * Validate a Button item's `buttonCta`. Mirrors the field checks
 * cta-buttons.serializer.ts runs per-button, but anchored at `buttonCta`
 * instead of an array entry.
 */
function validateButtonCta(
  buttonCta: CtaButtonEntry | undefined,
  index: number
): FieldError[] {
  const position = index + 1
  const fieldErrors: FieldError[] = []

  if (!buttonCta?.text || !buttonCta.text.trim())
    fieldErrors.push({
      message: `Content Block ${position}: Button Text is required`,
      path: ['reportText', index, 'buttonCta', 'text']
    })

  if (!buttonCta?.link || !buttonCta.link.trim())
    fieldErrors.push({
      message: `Content Block ${position}: Button Link is required`,
      path: ['reportText', index, 'buttonCta', 'link']
    })

  if (buttonCta?.style !== undefined && !isCtaButtonStyle(buttonCta.style))
    fieldErrors.push({
      message: `Content Block ${position}: Button has an unknown style "${buttonCta.style}". Use primary or secondary.`,
      path: ['reportText', index, 'buttonCta', 'style']
    })

  if (buttonCta && hasConflictingCtaFlags(buttonCta))
    fieldErrors.push({
      message: `Content Block ${position}: Button cannot be both external and document`,
      path: ['reportText', index, 'buttonCta', 'document']
    })

  return fieldErrors
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

  if (item.textType === 'Button')
    return validateButtonCta(item.buttonCta, index)

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

    if (textType === 'Button') {
      // Validation above guarantees text/link are present from here on.
      const button = item.buttonCta as CtaButtonEntry
      const attrs = [
        `type="Button"`,
        `buttonText="${esc(button.text!.trim())}"`,
        `buttonLink="${esc(button.link!.trim())}"`
      ]
      // Only emit non-default attrs, so a default-valued button round-trips
      // to the same MDX it came from (matches cta-buttons.serializer.ts).
      if (button.style && button.style !== 'primary')
        attrs.push(`buttonStyle="${esc(button.style)}"`)
      if (button.external) attrs.push('buttonExternal={true}')
      if (button.document) attrs.push('buttonDocument={true}')

      return `<ReportText ${attrs.join(' ')} />`
    }

    const raw = item[textField(textType)]!

    const text = escMdxBraces(ckeditorFieldToCompiledMarkdown(raw))

    return `<ReportText type="${textType}">\n\n${text}\n\n</ReportText>`
  })

  const heading = esc(block.heading!.trim())

  return `<ReportSection>\n\n## ${heading}\n\n${items.join('\n\n')}\n\n</ReportSection>`
}
