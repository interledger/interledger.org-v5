/**
 * ReportSection + ReportText component handler for the MDX block parser.
 *
 * Handles:
 * - <ReportSection heading="...">
 *     <ReportText type="Paragraph">
 *       markdown content
 *     </ReportText>
 *     <ReportText type="Disclaimer">
 *       markdown disclaimer
 *     </ReportText>
 *     ...
 *   </ReportSection>
 *
 * Maps to Strapi blocks.report-section. Each <ReportText> becomes one
 * `reportText` entry; its `type` attribute selects whether the children
 * populate `textContent` (Paragraph) or `textDisclaimer` (Disclaimer).
 */

import type {
  ParsedBlock,
  ReportSectionBlock,
  ReportTextItem
} from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getChildElements } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

const REPORT_TEXT_TYPES = ['Paragraph', 'Disclaimer'] as const
type ReportTextType = (typeof REPORT_TEXT_TYPES)[number]

function isReportTextType(value: string): value is ReportTextType {
  return REPORT_TEXT_TYPES.includes(value as ReportTextType)
}

function parseReportText(node: JsxBlockNode): ReportTextItem {
  const textType = getStringAttr(node, 'type', { required: true })
  if (!isReportTextType(textType)) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `ReportText "type" must be one of ${REPORT_TEXT_TYPES.join(', ')}, got "${textType}".`,
      component: 'ReportText',
      prop: 'type',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const content =
    node.children.length > 0 ? childrenToMarkdown(node.children) : ''
  if (!content) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'ReportText requires non-empty children content.',
      component: 'ReportText',
      prop: 'children',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return textType === 'Disclaimer'
    ? { textType, textDisclaimer: content }
    : { textType, textContent: content }
}

async function handleReportSection(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = getStringAttr(node, 'heading', { required: true })

    const itemNodes = getChildElements(node, 'ReportText')
    if (itemNodes.length === 0) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: 'ReportSection requires at least one <ReportText> child.',
        component: 'ReportSection',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: ReportSectionBlock = {
      __component: 'blocks.report-section',
      heading,
      reportText: itemNodes.map(parseReportText)
    }

    return [block]
  })
}

registerComponentHandler('ReportSection', handleReportSection)
