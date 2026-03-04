/**
 * JSX attribute extraction utilities for MDX AST nodes.
 *
 * Reads attribute values as text (string literals or expression source).
 * Parsers then interpret the text (e.g. boolean, JSON array).
 */

import type { MdxJsxFlowElement, MdxJsxAttribute } from 'mdast-util-mdx-jsx'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findAttr(
  node: MdxJsxFlowElement,
  name: string
): MdxJsxAttribute | undefined {
  return node.attributes.find(
    (attr): attr is MdxJsxAttribute =>
      attr.type === 'mdxJsxAttribute' && attr.name === name
  )
}

/** Get attribute value as raw text. String literal or expression source. */
function getAttrValueAsText(attr: MdxJsxAttribute): string {
  if (typeof attr.value === 'string') return attr.value
  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    return String(attr.value.value ?? '').trim()
  }
  return ''
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a string attribute value.
 * Returns the raw text (string literal or expression source).
 */
export function getStringAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts: { required: true }
): string
export function getStringAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts?: { required?: false }
): string | undefined
export function getStringAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts: { required?: boolean } = {}
): string | undefined {
  const attr = findAttr(node, name)
  if (!attr) {
    if (opts.required) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: `Required prop "${name}" is missing.`,
        component: node.name ?? undefined,
        prop: name,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }
    return undefined
  }
  return getAttrValueAsText(attr)
}

/**
 * Extract a boolean attribute value.
 * Valueless → true. Text "true"/"false" → parsed. Other text → undefined.
 */
export function getBooleanAttr(
  node: MdxJsxFlowElement,
  name: string
): boolean | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  if (attr.value === null || attr.value === undefined) return true
  const text = getAttrValueAsText(attr)
  if (text === 'true') return true
  if (text === 'false') return false
  return undefined
}

/**
 * Extract a string-array attribute from a JSX expression.
 * Expects JSON array with double-quoted strings.
 */
export function getStringArrayAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts: { required: true }
): string[]
export function getStringArrayAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts?: { required?: false }
): string[] | undefined
export function getStringArrayAttr(
  node: MdxJsxFlowElement,
  name: string,
  opts: { required?: boolean } = {}
): string[] | undefined {
  const attr = findAttr(node, name)
  if (!attr) {
    if (opts.required) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: `Required prop "${name}" is missing.`,
        component: node.name ?? undefined,
        prop: name,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }
    return undefined
  }

  const raw = getAttrValueAsText(attr)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed as string[]
    }
  } catch {
    // JSON.parse failed
  }

  throw new MdxParserError({
    code: ParserErrorCode.INVALID_PROP_VALUE,
    message: `Prop "${name}" must be a JSON array with double-quoted strings (e.g. {["a","b"]}).`,
    component: node.name ?? undefined,
    prop: name,
    line: node.position?.start.line,
    column: node.position?.start.column
  })
}
