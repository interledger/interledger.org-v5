/**
 * JSX attribute and child-element extraction utilities for MDX AST nodes.
 *
 * Provides safe, typed accessors for reading props and named child
 * elements from `mdast-util-mdx-jsx` JSX element nodes. All accessors
 * throw `MdxParserError` on unexpected shapes so callers get strict,
 * actionable failures.
 */

import type { RootContent } from 'mdast'
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
 * // <Ambassador pathSlug="caroline-sinders" />
 * getStringAttr(node, 'pathSlug')                    // → "caroline-sinders"
 * getStringAttr(node, 'bio')                          // → undefined
 * getStringAttr(node, 'pathSlug', { required: true }) // → "caroline-sinders"
 * getStringAttr(node, 'bio', { required: true })      // → throws MISSING_REQUIRED_PROP
 * // <Ambassador pathSlug={dynamicVar} />
 * getStringAttr(node, 'pathSlug')                     // → throws DYNAMIC_EXPRESSION
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
 * // <Ambassador active />           → true  (valueless)
 * // <Ambassador active={true} />    → true
 * // <Ambassador active={false} />   → false
 * // <Ambassador />                     → undefined (absent)
 * // <Ambassador active={someVar} /> → throws DYNAMIC_EXPRESSION
 * getBooleanAttr(node, 'active')
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

  // Valueless: <Foo active /> → true
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
 * // <AmbassadorGrid pathSlugs={["caroline-sinders","alex-smith"]} />
 * getStringArrayAttr(node, 'pathSlugs')  // → ["caroline-sinders", "alex-smith"]
 * // <AmbassadorGrid pathSlugs={myArray} />
 * getStringArrayAttr(node, 'pathSlugs')  // → throws DYNAMIC_EXPRESSION
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

  // Must be an expression: pathSlugs={["a","b"]}
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

/**
 * Detects genuine `${...}` interpolation inside a template-literal body.
 *
 * Only an *unescaped* `$` immediately followed by `{` is interpolation. A
 * `\${` (as produced by the CodeBlock serializer for literal `${`) is escaped
 * and must not be flagged. Backslashes are consumed in pairs so an escaped
 * backslash (`\\`) does not mask the `$` that follows it.
 */
function hasTemplateInterpolation(inner: string): boolean {
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\') {
      i++ // skip the escaped character
      continue
    }
    if (inner[i] === '$' && inner[i + 1] === '{') {
      return true
    }
  }
  return false
}

function unescapeTemplateLiteral(inner: string): string {
  let result = ''
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i]
    if (char !== '\\') {
      result += char
      continue
    }

    const next = inner[++i]
    switch (next) {
      case 'n':
        result += '\n'
        break
      case 't':
        result += '\t'
        break
      case 'r':
        result += '\r'
        break
      case '`':
        result += '`'
        break
      case '\\':
        result += '\\'
        break
      case '$':
        result += '$'
        break
      default:
        result += next ?? ''
        break
    }
  }
  return result
}

function parseStaticExpressionLiteral(
  raw: string,
  meta: {
    component?: string
    prop: string
    line?: number
    column?: number
  }
): string {
  const trimmed = raw.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const parsed: unknown = JSON.parse(
        trimmed.startsWith("'") ? trimmed.replace(/'/g, '"') : trimmed
      )
      if (typeof parsed === 'string') return parsed
    } catch {
      // Fall through to invalid value
    }
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${meta.prop}" must be a static string or template literal.`,
      component: meta.component,
      prop: meta.prop,
      line: meta.line,
      column: meta.column
    })
  }

  if (!trimmed.startsWith('`') || !trimmed.endsWith('`')) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${meta.prop}" must be a static string or template literal.`,
      component: meta.component,
      prop: meta.prop,
      line: meta.line,
      column: meta.column
    })
  }

  const inner = trimmed.slice(1, -1)

  if (hasTemplateInterpolation(inner)) {
    throw new MdxParserError({
      code: ParserErrorCode.DYNAMIC_EXPRESSION,
      message: `Prop "${meta.prop}" must be a static template literal without \${...} interpolation.`,
      component: meta.component,
      prop: meta.prop,
      line: meta.line,
      column: meta.column
    })
  }

  return unescapeTemplateLiteral(inner)
}

/** ESTree expression range for recovering raw JSX attribute source text. */
function getEstreeExpressionRange(
  value: MdxJsxAttribute['value']
): [number, number] | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    value.type !== 'mdxJsxAttributeValueExpression'
  ) {
    return undefined
  }

  const estree = value.data?.estree
  const statement = estree?.body?.[0]
  const expression =
    statement?.type === 'ExpressionStatement' ? statement.expression : undefined

  return Array.isArray(expression?.range) &&
    expression.range.length === 2 &&
    expression.range.every((offset) => typeof offset === 'number')
    ? (expression.range as [number, number])
    : undefined
}

/**
 * Extract a static JSX expression string (template literal or quoted string).
 *
 * Supports MDX export shapes such as:
 * - `code={\`const x = 1\`}`
 * - `code={"const x = 1"}`
 */
export function getStaticExpressionAttr(
  node: JsxBlockNode,
  name: string,
  opts: { required: true; sourceText?: string }
): string
export function getStaticExpressionAttr(
  node: JsxBlockNode,
  name: string,
  opts?: { required?: false; sourceText?: string }
): string | undefined
export function getStaticExpressionAttr(
  node: JsxBlockNode,
  name: string,
  opts: { required?: boolean; sourceText?: string } = {}
): string | undefined {
  const attr = findAttr(node, name)
  const meta = {
    component: node.name ?? undefined,
    prop: name,
    line: node.position?.start.line,
    column: node.position?.start.column
  }

  if (!attr) {
    if (opts.required) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: `Required prop "${name}" is missing.`,
        ...meta
      })
    }
    return undefined
  }

  if (typeof attr.value === 'string') {
    return attr.value
  }

  if (
    !attr.value ||
    typeof attr.value !== 'object' ||
    attr.value.type !== 'mdxJsxAttributeValueExpression'
  ) {
    if (opts.required) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "${name}" must be a static JSX expression.`,
        ...meta
      })
    }
    return undefined
  }

  let raw = attr.value.value.trim()
  const expressionRange = getEstreeExpressionRange(attr.value)
  if (opts.sourceText && expressionRange) {
    raw = opts.sourceText.slice(expressionRange[0], expressionRange[1]).trim()
  } else if (
    opts.sourceText &&
    attr.value.position?.start.offset != null &&
    attr.value.position?.end.offset != null
  ) {
    raw = opts.sourceText
      .slice(attr.value.position.start.offset, attr.value.position.end.offset)
      .trim()
  }

  if (raw.startsWith('{') && raw.endsWith('}')) {
    raw = raw.slice(1, -1).trim()
  }

  const parsed = parseStaticExpressionLiteral(raw, meta)
  if (!parsed && opts.required) {
    throw new MdxParserError({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      message: `Required prop "${name}" is empty.`,
      ...meta
    })
  }
  return parsed || undefined
}

// ---------------------------------------------------------------------------
// Static literal (array/object) attributes
// ---------------------------------------------------------------------------

interface StaticLiteralMeta {
  component?: string
  prop: string
  line?: number
  column?: number
}

/**
 * Minimal shape for any ESTree expression node — just enough to dispatch on
 * `.type`. No index signature on purpose: real ESTree interfaces don't have
 * one either, and TS rejects assigning into a type that does. Other fields
 * are read via a cast per case below.
 */
type EstreeNode = { type: string }

/**
 * Recursively evaluates a static ESTree expression node (Literal,
 * ArrayExpression, ObjectExpression) into a plain JS value. Anything
 * dynamic (identifiers, calls, spreads, computed keys) throws
 * DYNAMIC_EXPRESSION.
 */
function evaluateStaticLiteral(
  node: EstreeNode,
  meta: StaticLiteralMeta
): unknown {
  switch (node.type) {
    case 'Literal':
      return (node as unknown as { value: unknown }).value
    case 'ArrayExpression': {
      const { elements } = node as unknown as {
        elements: Array<EstreeNode | null>
      }
      return elements.map((el) => {
        if (!el) {
          throw new MdxParserError({
            code: ParserErrorCode.DYNAMIC_EXPRESSION,
            message: `Prop "${meta.prop}" contains a sparse array element.`,
            ...meta
          })
        }
        return evaluateStaticLiteral(el, meta)
      })
    }
    case 'ObjectExpression': {
      const { properties } = node as unknown as {
        properties: Array<{
          type: string
          computed?: boolean
          method?: boolean
          key: { type: string; name?: string; value?: unknown }
          value: EstreeNode
        }>
      }
      const result: Record<string, unknown> = {}
      for (const prop of properties) {
        if (prop.type !== 'Property' || prop.computed || prop.method) {
          throw new MdxParserError({
            code: ParserErrorCode.DYNAMIC_EXPRESSION,
            message: `Prop "${meta.prop}" contains an unsupported object property (spread, computed key, or method).`,
            ...meta
          })
        }
        const keyName =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'Literal' && typeof prop.key.value === 'string'
              ? prop.key.value
              : undefined
        if (keyName === undefined) {
          throw new MdxParserError({
            code: ParserErrorCode.DYNAMIC_EXPRESSION,
            message: `Prop "${meta.prop}" contains an object key that isn't a static identifier or string.`,
            ...meta
          })
        }
        result[keyName] = evaluateStaticLiteral(prop.value, meta)
      }
      return result
    }
    default:
      throw new MdxParserError({
        code: ParserErrorCode.DYNAMIC_EXPRESSION,
        message: `Prop "${meta.prop}" must be a static literal (string, number, boolean, null, array, or object) — found "${node.type}".`,
        ...meta
      })
  }
}

/**
 * Extract a prop whose value is a static JS literal expression — strings,
 * numbers, booleans, null, and arrays/objects nesting those.
 *
 * @example
 * ```ts
 * // <LogoCarousel logos={[{ name: 'Plata', src: '/x.png' }]} />
 * getStaticLiteralAttr(node, 'logos', { required: true })
 * // → [{ name: 'Plata', src: '/x.png' }]
 * ```
 */
export function getStaticLiteralAttr(
  node: JsxBlockNode,
  name: string,
  opts: { required?: boolean } = {}
): unknown {
  const attr = findAttr(node, name)
  const meta: StaticLiteralMeta = {
    component: node.name ?? undefined,
    prop: name,
    line: node.position?.start.line,
    column: node.position?.start.column
  }

  if (!attr) {
    if (opts.required) {
      throw new MdxParserError({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        message: `Required prop "${name}" is missing.`,
        ...meta
      })
    }
    return undefined
  }

  if (
    !attr.value ||
    typeof attr.value !== 'object' ||
    attr.value.type !== 'mdxJsxAttributeValueExpression'
  ) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${name}" must be a JSX expression (e.g. {[...]} or {{...}}).`,
      ...meta
    })
  }

  const estree = attr.value.data?.estree
  const statement = estree?.body?.[0]
  const expression =
    statement?.type === 'ExpressionStatement' ? statement.expression : undefined

  if (!expression) {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message: `Prop "${name}" could not be statically analyzed.`,
      ...meta
    })
  }

  return evaluateStaticLiteral(expression, meta)
}

// ---------------------------------------------------------------------------
// Child elements
// ---------------------------------------------------------------------------

/**
 * Resolve a child node to the JSX element it represents.
 *
 * A tag whose open and close are on the same line (e.g. `<Card>text</Card>`)
 * is inline content, so remark wraps it in a `paragraph` node — even when
 * it's that paragraph's only content. A tag spanning multiple lines (open
 * tag, then content, then close tag, each on their own line) is block-level
 * and needs no unwrapping. This resolves both forms to the same element.
 */
function toJsxElement(child: RootContent): JsxBlockNode | undefined {
  if (
    child.type === 'mdxJsxFlowElement' ||
    child.type === 'mdxJsxTextElement'
  ) {
    return child
  }
  if (
    child.type === 'paragraph' &&
    child.children.length === 1 &&
    child.children[0].type === 'mdxJsxTextElement'
  ) {
    return child.children[0]
  }
  return undefined
}

/**
 * Collect all `<Name>` JSX element children of a node, regardless of
 * whether each one was written on its own line or inline with siblings.
 *
 * @example
 * ```ts
 * // <Grid>
 * //   <Card />
 * //   <Card />
 * // </Grid>
 * getChildElements(node, 'Card')  // → [cardNode, cardNode]
 * ```
 */
export function getChildElements(
  node: JsxBlockNode,
  name: string
): JsxBlockNode[] {
  const elements: JsxBlockNode[] = []
  for (const child of node.children) {
    const element = toJsxElement(child)
    if (element && element.name === name) {
      elements.push(element)
    }
  }
  return elements
}
