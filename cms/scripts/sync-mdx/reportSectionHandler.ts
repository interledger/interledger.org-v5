/**
 * ReportSection + ReportText component handler for the MDX block parser.
 *
 * Handles:
 * - <ReportSection>
 *
 *     ## Heading
 *
 *     <ReportText type="Paragraph">
 *       markdown content
 *     </ReportText>
 *     <ReportText type="Disclaimer">
 *       markdown disclaimer
 *     </ReportText>
 *     ...
 *   </ReportSection>
 *
 * Maps to Strapi blocks.report-section. The heading is authored as a real
 * markdown `##` line (not a JSX prop) so Astro's own heading collector can
 * pick it up for ReportSectionsNav — see report-section.serializer.ts and
 * ReportPage.astro. Each <ReportText> becomes one `reportText` entry; its
 * `type` attribute selects whether the children populate `textContent`
 * (Paragraph) or `textDisclaimer` (Disclaimer).
 */

import type { Heading, Text } from 'mdast'
import type {
  ParsedBlock,
  ReportSectionBlock,
  ReportTextItem
} from './types.blocks'
import { REPORT_TEXT_TYPES, isReportTextType } from './types.blocks'
import {
  isCtaButtonStyle,
  hasConflictingCtaFlags
} from '../../src/utils/ctaButtons'
import { extractChildrenContent } from './mdastSerialize'
import { getStringAttr, getBooleanAttr, getChildElements } from './jsxExtract'
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

// Matches report-section.serializer.ts, which emits the section title as a
// markdown `##` line — depth 2 is what makes it a *section* heading rather
// than a heading nested inside a <ReportText>'s own markdown content.
const SECTION_HEADING_DEPTH = 2

/**
 * Reads the heading's text from the AST, not a raw source slice (unlike
 * extractChildrenContent). The serializer HTML-escapes `&`/`<`/`>`/quotes in
 * the heading, and commonmark decodes those entities back to literal
 * characters in text nodes — so `.value` already has the original heading.
 */
function getHeadingText(heading: Heading): string | undefined {
  const text = heading.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')

  return text || undefined
}

function parseHeading(node: JsxBlockNode): string {
  const headingNode = node.children.find(
    (child): child is Heading =>
      child.type === 'heading' && child.depth === SECTION_HEADING_DEPTH
  )

  const heading = headingNode ? getHeadingText(headingNode) : undefined

  if (!heading) {
    throw new MdxParserError({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      message:
        'ReportSection requires a leading "## Heading" line before its <ReportText> children.',
      component: 'ReportSection',
      prop: 'heading',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return heading
}

function parseReportText(
  node: JsxBlockNode,
  ctx: ParserContext
): ReportTextItem {
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

  if (textType === 'Button') return parseButtonReportText(node, textType)

  // Prefer raw source slicing over AST re-serialization: footnote markers
  // ([^1]) and other literal markdown-like text get escaped by
  // mdast-util-to-markdown, corrupting content that was never ambiguous in
  // the source. See mdastSerialize's extractChildrenContent for details.
  const content = extractChildrenContent(node.children, ctx) ?? ''
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

/**
 * A Button item carries no rich-text children — its data lives entirely in
 * attributes on the self-closing `<ReportText type="Button" .../>` tag,
 * matching how report-section.serializer.ts emits it.
 */
function parseButtonReportText(
  node: JsxBlockNode,
  textType: 'Button'
): ReportTextItem {
  const text = getStringAttr(node, 'buttonText', { required: true })
  const link = getStringAttr(node, 'buttonLink', { required: true })
  const style = getStringAttr(node, 'buttonStyle')
  const external = getBooleanAttr(node, 'buttonExternal')
  const document = getBooleanAttr(node, 'buttonDocument')

  if (style !== undefined && !isCtaButtonStyle(style)) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `ReportText "buttonStyle" must be "primary" or "secondary", got "${style}".`,
      component: 'ReportText',
      prop: 'buttonStyle',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const buttonCta = {
    text,
    link,
    style: (style ?? 'primary') as 'primary' | 'secondary',
    ...(external ? { external: true } : {}),
    ...(document ? { document: true } : {})
  }

  if (hasConflictingCtaFlags(buttonCta)) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'ReportText Button cannot be both external and document. Pick one: ' +
        'external opens a new tab, document downloads a file.',
      component: 'ReportText',
      prop: 'buttonDocument',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return { textType, buttonCta }
}

async function handleReportSection(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const heading = parseHeading(node)

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
      reportText: itemNodes.map((item) => parseReportText(item, ctx))
    }

    return [block]
  })
}

registerComponentHandler('ReportSection', handleReportSection)
