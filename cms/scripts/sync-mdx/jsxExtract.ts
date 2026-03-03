/**
 * JSX AST attribute extraction helpers.
 *
 * These utilities read typed values from mdxJsxFlowElement attribute nodes
 * produced by remark-mdx.  They are shared across all block parsers and
 * enforce strict-mode: dynamic JS expressions (variables, function calls,
 * template literals) throw an error rather than silently returning wrong data.
 *
 * Every helper returns `undefined` when the attribute is simply absent,
 * so callers can distinguish "not provided" from "provided but wrong type".
 */

import type { MdxJsxFlowElement, MdxJsxAttribute } from 'mdast-util-mdx-jsx'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find a named attribute on a JSX element node.
 * Returns `undefined` when the attribute does not exist.
 * Throws on spread/expression attributes (`{...props}`).
 */
function findAttr(
  node: MdxJsxFlowElement,
  name: string
): MdxJsxAttribute | undefined {
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxExpressionAttribute') {
      // e.g. {...spreadProps} — we never allow these
      continue
    }
    if (attr.name === name) return attr
  }
  return undefined
}

/**
 * Human-readable label for error messages.
 */
function loc(node: MdxJsxFlowElement): string {
  return `<${node.name ?? 'unknown'}>`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a string literal attribute.
 * `<Foo bar="hello" />` → `"hello"`
 */
export function getStringAttr(
  node: MdxJsxFlowElement,
  name: string
): string | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  // Simple string literal: value is a plain string
  if (typeof attr.value === 'string') return attr.value

  // Expression wrapper: `bar={"hello"}` — value is { type: 'mdxJsxAttributeValueExpression', value: '"hello"' }
  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    const raw = attr.value.value.trim()
    // Only accept string literals (single or double quoted)
    const m = raw.match(/^(['"])(.*)\1$/)
    if (m) return m[2]

    throw new Error(
      `Unsupported expression in prop '${name}' on ${loc(node)}: only static string literals are allowed, got: ${raw}`
    )
  }

  // Boolean shorthand `<Foo bar />` — value is null, not a string
  if (attr.value === null) {
    throw new Error(
      `Expected string value for prop '${name}' on ${loc(node)}, got boolean shorthand`
    )
  }

  throw new Error(`Unexpected value type for prop '${name}' on ${loc(node)}`)
}

/**
 * Read a numeric literal attribute.
 * `<Foo columns={3} />` → `3`
 */
export function getNumberAttr(
  node: MdxJsxFlowElement,
  name: string
): number | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    const raw = attr.value.value.trim()
    const n = Number(raw)
    if (!Number.isNaN(n)) return n

    throw new Error(
      `Unsupported expression in prop '${name}' on ${loc(node)}: only static numeric literals are allowed, got: ${raw}`
    )
  }

  // Might be passed as a plain string attribute `columns="3"`
  if (typeof attr.value === 'string') {
    const n = Number(attr.value)
    if (!Number.isNaN(n)) return n

    throw new Error(
      `Expected numeric value for prop '${name}' on ${loc(node)}, got: "${attr.value}"`
    )
  }

  throw new Error(`Unexpected value type for prop '${name}' on ${loc(node)}`)
}

/**
 * Read a boolean attribute.
 * `<Foo showLinks={false} />` → `false`
 * `<Foo showLinks />` → `true` (shorthand)
 */
export function getBooleanAttr(
  node: MdxJsxFlowElement,
  name: string
): boolean | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  // Boolean shorthand: `<Foo showLinks />`
  if (attr.value === null) return true

  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    const raw = attr.value.value.trim()
    if (raw === 'true') return true
    if (raw === 'false') return false

    throw new Error(
      `Unsupported expression in prop '${name}' on ${loc(node)}: only static boolean literals are allowed, got: ${raw}`
    )
  }

  // String values "true"/"false" (lenient)
  if (typeof attr.value === 'string') {
    if (attr.value === 'true') return true
    if (attr.value === 'false') return false

    throw new Error(
      `Expected boolean value for prop '${name}' on ${loc(node)}, got: "${attr.value}"`
    )
  }

  throw new Error(`Unexpected value type for prop '${name}' on ${loc(node)}`)
}

/**
 * Read an array-of-strings expression attribute.
 * `<Foo slugs={["a","b"]} />` → `["a","b"]`
 *
 * Only supports static arrays of string literals.
 */
export function getStringArrayAttr(
  node: MdxJsxFlowElement,
  name: string
): string[] | undefined {
  const attr = findAttr(node, name)
  if (!attr) return undefined

  if (
    attr.value &&
    typeof attr.value === 'object' &&
    attr.value.type === 'mdxJsxAttributeValueExpression'
  ) {
    const raw = attr.value.value.trim()
    // Must look like an array literal: [...]
    if (!raw.startsWith('[') || !raw.endsWith(']')) {
      throw new Error(
        `Unsupported expression in prop '${name}' on ${loc(node)}: expected an array literal, got: ${raw}`
      )
    }

    // Parse the array by evaluating a JSON-compatible form.
    // The remark-mdx parser gives us the raw JS text, e.g. ["a","b"]
    // We need to handle both single and double quoted strings.
    const inner = raw.slice(1, -1).trim()
    if (inner === '') return []

    const items: string[] = []
    // Match quoted strings (double or single)
    const strRegex = /(['"])((?:\\.|(?!\1).)*)\1/g
    let match
    while ((match = strRegex.exec(inner)) !== null) {
      items.push(match[2])
    }

    // Verify we consumed all meaningful content (no non-string elements)
    const cleaned = inner
      .replace(/(['"])((?:\\.|(?!\1).)*)\1/g, '')
      .replace(/[,\s]/g, '')
    if (cleaned.length > 0) {
      throw new Error(
        `Array in prop '${name}' on ${loc(node)} contains non-string elements: ${raw}`
      )
    }

    return items
  }

  throw new Error(
    `Expected expression value for prop '${name}' on ${loc(node)}, got: ${typeof attr.value === 'string' ? `"${attr.value}"` : String(attr.value)}`
  )
}

/**
 * Serialize a JSX element's children back to a markdown/text string.
 * Used for components like `<Blockquote>Some **bold** text</Blockquote>`.
 *
 * Returns an empty string for self-closing or childless elements.
 */
export function getChildrenText(node: MdxJsxFlowElement): string {
  if (!node.children || node.children.length === 0) return ''

  // Serialize children back to markdown using mdast-util-to-markdown
  // We create a virtual root node containing just the children
  const result = toMarkdown(
    {
      type: 'root',
      children: [...node.children] as Parameters<
        typeof toMarkdown
      >[0]['children']
    },
    { extensions: [mdxJsxToMarkdown()] }
  )

  return result.trim()
}
