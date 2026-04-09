/**
 * Paragraph component handler for the MDX block parser.
 *
 * Handles:
 * - <Paragraph>markdown content</Paragraph>
 * - <Paragraph content="markdown string" />
 *
 * Maps to Strapi blocks.paragraph.
 */

import type { RootContent } from 'mdast'
import type { ParsedBlock, ParagraphBlock } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

/**
 * Walk AST children looking for nested JSX elements (flow or text).
 * Returns the first match with its name and position, or undefined if clean.
 */
function findNestedJsx(
  children: RootContent[]
): { name: string; line?: number; column?: number } | undefined {
  for (const child of children) {
    if (
      child.type === 'mdxJsxFlowElement' ||
      child.type === 'mdxJsxTextElement'
    ) {
      const jsx = child as { name?: string; position?: RootContent['position'] }
      const name = jsx.name ?? ''
      // Only flag custom JSX components (capital letter) — skip HTML elements like <br>, <span>
      if (name && /^[A-Z]/.test(name)) {
        return {
          name,
          line: jsx.position?.start.line,
          column: jsx.position?.start.column
        }
      }
    }
    // Recurse into paragraph nodes which may wrap text-level JSX
    if (child.type === 'paragraph' && 'children' in child) {
      const found = findNestedJsx(
        (child as { children: RootContent[] }).children
      )
      if (found) return found
    }
  }
  return undefined
}

/**
 * Extract content from Paragraph children, preferring raw source slicing
 * over AST re-serialization to avoid lossy transformations.
 */
function extractChildrenContent(
  children: RootContent[] | undefined,
  ctx: ParserContext
): string | undefined {
  if (!children || children.length === 0) return undefined

  // When sourceText is available and children have position info,
  // slice the raw source to preserve original formatting byte-for-byte.
  if (ctx.sourceText) {
    const first = children[0]
    const last = children[children.length - 1]
    if (
      first.position?.start.offset != null &&
      last.position?.end.offset != null
    ) {
      const raw = ctx.sourceText
        .slice(first.position.start.offset, last.position.end.offset)
        .trim()
      if (raw) return raw
    }
  }

  // Fallback: re-serialize from AST
  return childrenToMarkdown(children)
}

async function handleParagraph(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[]> {
  // Prefer content prop if present: <Paragraph content="..." />
  const contentAttr = getStringAttr(node, 'content')

  let content: string
  if (contentAttr !== undefined) {
    content = contentAttr
  } else {
    // Extract from children: <Paragraph>...children...</Paragraph>
    const children = node.children

    // Guard: detect nested JSX before extracting content
    if (children && children.length > 0) {
      const nestedJsx = findNestedJsx(children)
      if (nestedJsx) {
        throw new MdxParserError({
          code: ParserErrorCode.NESTED_JSX,
          message: `Paragraph contains nested JSX component \`<${nestedJsx.name}>\` at line ${nestedJsx.line ?? '?'}. Move it to a top-level sibling, or wrap it in a code block if it's meant to be literal text.`,
          component: 'Paragraph',
          line: nestedJsx.line,
          column: nestedJsx.column
        })
      }
    }

    // Prefer raw source slicing when available to avoid lossy AST
    // re-serialization (HTML entity decoding, bracket escaping).
    content = extractChildrenContent(children, ctx) ?? ''
  }

  if (!content) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message:
        'Paragraph requires non-empty content. Strapi blocks.paragraph has content as required.',
      component: 'Paragraph',
      prop: 'content',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return [buildParagraphBlock(node, content)]
}

function buildParagraphBlock(
  node: JsxBlockNode,
  content: string
): ParagraphBlock {
  const alignment = getStringAttr(node, 'alignment')
  const block: ParagraphBlock = {
    __component: 'blocks.paragraph',
    content
  }
  if (alignment === 'center' || alignment === 'right') {
    block.alignment = alignment
  }
  return block
}

registerComponentHandler('Paragraph', handleParagraph)
