/**
 * JSX attribute extraction utilities for MDX AST nodes.
 *
 * Provides safe, typed accessors for reading props from
 * `mdast-util-mdx-jsx` JSX element nodes. All accessors
 * throw `MdxParserError` on unexpected shapes so callers
 * get strict, actionable failures.
 */

import type { MdxJsxAttribute } from 'mdast-util-mdx-jsx'
import type { JsxBlockNode } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a JSX attribute by name on an MDX JSX element.
 * Returns `undefined` when the attribute is absent.
 */
function findAttr(
  node: JsxBlockNode,
  name: string
): MdxJsxAttribute | undefined {
  return node.attributes.find(
    (attr): attr is MdxJsxAttribute =>
      attr.type === 'mdxJsxAttribute' && attr.name === name
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a string attribute value.
 *
 * @example
 * ```ts
 * // <Ambassador slug="caroline-sinders" />
 * getStringAttr(node, 'slug')                        // → "caroline-sinders"
 * getStringAttr(node, 'bio')                          // → undefined
 * getStringAttr(node, 'slug', { required: true })     // → "caroline-sinders"
 * getStringAttr(node, 'bio', { required: true })      // → throws MISSING_REQUIRED_PROP
 * // <Ambassador slug={dynamicVar} />
 * getStringAttr(node, 'slug')                         // → throws DYNAMIC_EXPRESSION
 * ```
 *
 * @param node - JSX AST node
 * @param name - Attribute name
 * @param opts.required - When true, throws if the attribute is missing
 * @returns The string value, or `undefined` if absent and not required
 */
export function getStringAttr(
  node: JsxBlockNode,
  name: string,
  opts: { required: true }
): string
export function getStringAttr(
  node: JsxBlockNode,
  name: string,
  opts?: { required?: false }
): string | undefined
export function getStringAttr(
  node: JsxBlockNode,
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

  // String literal: <Foo bar="baz" />
  if (typeof attr.value === 'string') {
    return attr.value
  }

  // Expression container: <Foo bar={"baz"} /> or <Foo bar={`baz`} />
  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    throw new MdxParserError({
      code: ParserErrorCode.DYNAMIC_EXPRESSION,
      message: `Prop "${name}" must be a static string, not an expression.`,
      component: node.name ?? undefined,
      prop: name,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  if (opts.required) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${name}" has an unexpected value shape.`,
      component: node.name ?? undefined,
      prop: name,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return undefined
}

/**
 * Extract a boolean attribute value.
 *
 * @example
 * ```ts
 * // <Ambassador showLinks />           → true  (valueless)
 * // <Ambassador showLinks={true} />    → true
 * // <Ambassador showLinks={false} />   → false
 * // <Ambassador />                     → undefined (absent)
 * // <Ambassador showLinks={someVar} /> → throws DYNAMIC_EXPRESSION
 * getBooleanAttr(node, 'showLinks')
 * ```
 *
 * @returns The boolean value, or `undefined` if absent
 */
export function getBooleanAttr(
  node: JsxBlockNode,
  name: string
): boolean | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  // Valueless: <Foo showLinks /> → true
  if (attr.value === null || attr.value === undefined) {
    return true
  }

  // String "true" / "false" (rare but valid in some MDX)
  if (attr.value === 'true') return true
  if (attr.value === 'false') return false

  // Expression: <Foo bar={true} /> or <Foo bar={false} />
  if (
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    const raw = attr.value.value.trim()
    if (raw === 'true') return true
    if (raw === 'false') return false

    throw new MdxParserError({
      code: ParserErrorCode.DYNAMIC_EXPRESSION,
      message: `Prop "${name}" must be a static boolean (true/false), got "${raw}".`,
      component: node.name ?? undefined,
      prop: name,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  return undefined
}

/**
 * Extract a string-array attribute from a JSX expression.
 *
 * Only static JSON arrays are supported. Dynamic expressions throw.
 *
 * @example
 * ```ts
 * // <AmbassadorGrid slugs={["caroline-sinders","alex-smith"]} />
 * getStringArrayAttr(node, 'slugs')  // → ["caroline-sinders", "alex-smith"]
 * // <AmbassadorGrid slugs={myArray} />
 * getStringArrayAttr(node, 'slugs')  // → throws DYNAMIC_EXPRESSION
 * ```
 *
 * @returns The string array, or `undefined` if absent
 */
export function getStringArrayAttr(
  node: JsxBlockNode,
  name: string,
  opts: { required: true }
): string[]
export function getStringArrayAttr(
  node: JsxBlockNode,
  name: string,
  opts?: { required?: false }
): string[] | undefined
export function getStringArrayAttr(
  node: JsxBlockNode,
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

  // Must be an expression: slugs={["a","b"]}
  if (
    !attr.value ||
    typeof attr.value !== 'object' ||
    attr.value.type !== 'mdxJsxAttributeValueExpression'
  ) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${name}" must be a JSX expression array (e.g. {["a","b"]}).`,
      component: node.name ?? undefined,
      prop: name,
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const raw = attr.value.value.trim()

  // Try JSON parse first (double-quoted strings), then normalize
  // single quotes to double quotes for JS-style arrays like ['a','b'].
  for (const candidate of [raw, raw.replace(/'/g, '"')]) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
      ) {
        return parsed as string[]
      }
    } catch {
      // Try next candidate
    }
  }

  throw new MdxParserError({
    code: ParserErrorCode.DYNAMIC_EXPRESSION,
    message: `Prop "${name}" contains a dynamic expression that cannot be statically evaluated.`,
    component: node.name ?? undefined,
    prop: name,
    line: node.position?.start.line,
    column: node.position?.start.column
  })
}
