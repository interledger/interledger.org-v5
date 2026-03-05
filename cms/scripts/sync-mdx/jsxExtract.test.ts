import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { Root } from 'mdast'

import { getStringAttr, getBooleanAttr, getStringArrayAttr } from './jsxExtract'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Helper: parse MDX snippet and extract the first JSX flow element
// ---------------------------------------------------------------------------

function parseJsx(mdx: string): MdxJsxFlowElement {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(mdx) as Root
  const node = tree.children.find((n) => n.type === 'mdxJsxFlowElement')
  if (!node) throw new Error('No JSX flow element found in snippet')
  return node as MdxJsxFlowElement
}

// ---------------------------------------------------------------------------
// getStringAttr
// ---------------------------------------------------------------------------

describe('getStringAttr', () => {
  it('extracts a string literal attribute', () => {
    const node = parseJsx('<Foo bar="hello" />')
    expect(getStringAttr(node, 'bar')).toBe('hello')
  })

  it('returns undefined for missing optional attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getStringAttr(node, 'bar')).toBeUndefined()
  })

  it('throws MISSING_REQUIRED_PROP for missing required attribute', () => {
    const node = parseJsx('<Foo />')
    expect(() => getStringAttr(node, 'bar', { required: true })).toThrow(
      MdxParserError
    )
    expect(() => getStringAttr(node, 'bar', { required: true })).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        prop: 'bar'
      })
    )
  })

  it('throws DYNAMIC_EXPRESSION for expression values', () => {
    const node = parseJsx('<Foo bar={someVar} />')
    expect(() => getStringAttr(node, 'bar')).toThrow(MdxParserError)
    expect(() => getStringAttr(node, 'bar')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.DYNAMIC_EXPRESSION
      })
    )
  })
})

// ---------------------------------------------------------------------------
// getBooleanAttr
// ---------------------------------------------------------------------------

describe('getBooleanAttr', () => {
  it('returns true for valueless attribute (<Foo bar />)', () => {
    const node = parseJsx('<Foo bar />')
    expect(getBooleanAttr(node, 'bar')).toBe(true)
  })

  it('returns true for expression {true}', () => {
    const node = parseJsx('<Foo bar={true} />')
    expect(getBooleanAttr(node, 'bar')).toBe(true)
  })

  it('returns false for expression {false}', () => {
    const node = parseJsx('<Foo bar={false} />')
    expect(getBooleanAttr(node, 'bar')).toBe(false)
  })

  it('returns undefined for missing attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getBooleanAttr(node, 'bar')).toBeUndefined()
  })

  it('throws DYNAMIC_EXPRESSION for non-boolean expression', () => {
    const node = parseJsx('<Foo bar={someVar} />')
    expect(() => getBooleanAttr(node, 'bar')).toThrow(MdxParserError)
    expect(() => getBooleanAttr(node, 'bar')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.DYNAMIC_EXPRESSION
      })
    )
  })
})

// ---------------------------------------------------------------------------
// getStringArrayAttr
// ---------------------------------------------------------------------------

describe('getStringArrayAttr', () => {
  it('extracts a static string array with double quotes', () => {
    const node = parseJsx('<Foo items={["a","b","c"]} />')
    expect(getStringArrayAttr(node, 'items')).toEqual(['a', 'b', 'c'])
  })

  it('extracts array with apostrophes in slugs (double-quoted, no escaping needed)', () => {
    const node = parseJsx('<Foo items={["it\'s-a-slug","other"]} />')
    expect(getStringArrayAttr(node, 'items')).toEqual(["it's-a-slug", 'other'])
  })

  it('throws DYNAMIC_EXPRESSION for single-quoted array (not supported)', () => {
    const node = parseJsx("<Foo items={['a','b']} />")
    expect(() => getStringArrayAttr(node, 'items')).toThrow(MdxParserError)
    expect(() => getStringArrayAttr(node, 'items')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.DYNAMIC_EXPRESSION
      })
    )
  })

  it('returns undefined for missing optional attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getStringArrayAttr(node, 'items')).toBeUndefined()
  })

  it('throws MISSING_REQUIRED_PROP for missing required attribute', () => {
    const node = parseJsx('<Foo />')
    expect(() => getStringArrayAttr(node, 'items', { required: true })).toThrow(
      MdxParserError
    )
    expect(() => getStringArrayAttr(node, 'items', { required: true })).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.MISSING_REQUIRED_PROP
      })
    )
  })

  it('throws INVALID_PROP_VALUE for plain string attribute', () => {
    const node = parseJsx('<Foo items="not-an-array" />')
    expect(() => getStringArrayAttr(node, 'items')).toThrow(MdxParserError)
    expect(() => getStringArrayAttr(node, 'items')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.INVALID_PROP_VALUE
      })
    )
  })

  it('throws DYNAMIC_EXPRESSION for non-static expression', () => {
    const node = parseJsx('<Foo items={someVar} />')
    expect(() => getStringArrayAttr(node, 'items')).toThrow(MdxParserError)
    expect(() => getStringArrayAttr(node, 'items')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.DYNAMIC_EXPRESSION
      })
    )
  })
})
