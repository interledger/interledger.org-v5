/**
 * Extracts the leading <ReportIntro> block from a report's raw MDX body,
 * pulling its markdown content out for the `introParagraph` Strapi field
 * before the remainder is handed to `parseMdxToBlocks` for the `content`
 * dynamic zone. See generateReportMdx (cms/src/utils/reportMdx.ts) for the
 * export side of this round trip.
 *
 * <ReportIntro> must be the first top-level element in the body, and may
 * appear only once. This isn't a parser limitation to work around — it's an
 * invariant this file enforces on purpose: `generateReportMdx` only ever
 * emits zero or one, always first (it's derived from a single Strapi
 * field), and ReportPage.astro's two-column grid layout assumes the intro
 * always occupies row 1. A `<ReportIntro>` anywhere else in a hand-edited
 * `.mdx` file is rejected rather than silently dropped or merged into the
 * content dynamic zone.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { Root } from 'mdast'
import { unwrapTextElement, type JsxBlockNode } from './mdxBlockParser'
import { extractChildrenContent } from './mdastSerialize'
import { MdxParserError, ParserErrorCode } from './parserErrors'

const REPORT_INTRO_COMPONENT = 'ReportIntro'

export interface ReportIntroExtraction {
  introParagraph: string | null
  /** The body with the leading <ReportIntro> block removed, ready for parseMdxToBlocks. */
  remainingContent: string
}

function getJsxNode(node: Root['children'][number]): JsxBlockNode | undefined {
  return node.type === 'mdxJsxFlowElement' ? node : unwrapTextElement(node)
}

export function extractReportIntro(
  mdxBody: string
): ReportIntroExtraction | MdxParserError {
  const trimmed = mdxBody.trim()
  if (!trimmed) return { introParagraph: null, remainingContent: mdxBody }

  let tree: Root
  try {
    tree = unified().use(remarkParse).use(remarkMdx).parse(trimmed)
  } catch (err) {
    return new MdxParserError({
      code: ParserErrorCode.MDX_PARSE_ERROR,
      message: `Failed to parse MDX: ${err instanceof Error ? err.message : String(err)}`
    })
  }

  const introNodes = tree.children
    .map(getJsxNode)
    .filter(
      (node): node is JsxBlockNode =>
        node !== undefined && node.name === REPORT_INTRO_COMPONENT
    )

  if (introNodes.length === 0) {
    return { introParagraph: null, remainingContent: mdxBody }
  }

  if (introNodes.length > 1) {
    const extra = introNodes[1]!
    return new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'ReportIntro may only appear once in a report body.',
      component: REPORT_INTRO_COMPONENT,
      line: extra.position?.start.line,
      column: extra.position?.start.column
    })
  }

  const [introNode] = introNodes
  const firstChild = tree.children[0]!
  const isFirst = getJsxNode(firstChild) === introNode

  if (!isFirst) {
    return new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: 'ReportIntro must be the first element in the report body.',
      component: REPORT_INTRO_COMPONENT,
      line: introNode.position?.start.line,
      column: introNode.position?.start.column
    })
  }

  const introParagraph =
    extractChildrenContent(introNode.children, {
      sourceText: trimmed,
      sourceTextWasProvided: true
    }) ?? null

  const introEnd = firstChild.position?.end.offset
  const remainingContent =
    introEnd != null ? trimmed.slice(introEnd).trim() : ''

  return { introParagraph, remainingContent }
}
